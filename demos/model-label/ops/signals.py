"""Conservative public-catalogue discovery and operator status parsing."""
import re
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.hrefs=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a' and dict(attrs).get('href'): self.hrefs.append(dict(attrs)['href'])

def discover(html,base,provider):
    parser=Links();parser.feed(html);found={}
    patterns={'OpenAI':r'/api/docs/models/([a-z0-9][a-z0-9.-]*)/?$', 'Google':r'/gemini-api/docs/models/((?:gemini|gemma)-[a-z0-9.-]+)/?$', 'Anthropic':r'/docs/en/models/((?:opus|sonnet|haiku|fable|mythos)-[a-z0-9.-]+)/overview/?$'}
    for href in parser.hrefs:
        url=urljoin(base,href);parts=urlsplit(url)
        if parts.scheme!='https' or parts.netloc!=urlsplit(base).netloc:continue
        match=re.search(patterns[provider],parts.path)
        if not match:continue
        identifier=match.group(1)
        if provider=='OpenAI' and not re.match(r'(gpt-|o[1-9]|chatgpt-|text-|dall-|whisper|tts-|sora|codex)',identifier):continue
        if provider=='Anthropic':identifier='claude-'+identifier.replace('.', '-')
        found[identifier]={'id':identifier,'provider':provider,'url':url.split('?')[0],'evidence':'Discovered in official catalogue; specification review pending'}
    return list(found.values())

def operator_status(payload,needle):
    components=[c for c in payload.get('components',[]) if needle.lower() in c.get('name','').lower()]
    if not components:return {'status':'unknown','reason':'No matching deployment component in this feed','components':[]}
    values=[c.get('status') for c in components]
    if 'major_outage' in values:status='unavailable'
    elif any(v in {'partial_outage','degraded_performance','under_maintenance'} for v in values):status='degraded'
    elif all(v=='operational' for v in values):status='serving'
    else:status='unknown'
    return {'status':status,'reason':'Operator-reported components; not an independent query test','components':[{'name':c.get('name'),'status':c.get('status')} for c in components]}


def google_workspace_status(payload, needle='Gemini'):
    """Google's incident feed: ended incidents must never count as outages."""
    if not isinstance(payload, list) or any(not isinstance(i, dict) for i in payload):
        raise ValueError('Unexpected Google incident feed format')
    matches=[i for i in payload if not i.get('end') and
             (i.get('service_name','').lower()==needle.lower() or
              any(p.get('title','').lower()==needle.lower() for p in i.get('affected_products',[])))]
    states=[i.get('most_recent_update',{}).get('status',i.get('status_impact')) for i in matches]
    if 'SERVICE_OUTAGE' in states: status='unavailable'
    elif 'SERVICE_DISRUPTION' in states: status='degraded'
    elif matches: status='unknown'
    else: status='serving'
    return {'status':status,'reason':'Google Workspace Gemini status: no active incident reported' if not matches else 'Active Google Workspace Gemini incident; operator report',
            'scope':'Gemini web app / Workspace dashboard; not Gemini API or an Irish inference test',
            'components':[{'name':needle,'status':status}],
            'incidents':[{'id':i.get('id'),'begin':i.get('begin')} for i in matches]}
