#!/usr/bin/env python3
"""EnvAI daily updates: approved releases + usable web-tool discovery candidates.

New GitHub repositories are NOT public discoveries on their own. To appear in
What's New a candidate needs a non-repository HTTPS tool URL, tool-like
metadata and an HTTP-reachable website. This confirms reachability only,
not that the app works or that its environmental/AI claims are correct.
"""
from __future__ import annotations
import argparse
import ipaddress
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse, urljoin
from urllib.request import Request, urlopen
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / 'demos/envai/data/live-updates.json'
TOOLS_PATH = ROOT / 'demos/envai/data/tools.json'

# Only repositories already identified as source links for catalogued tools.
# A GitHub release is a factual software RELEASE signal, not a verified
# environmental benefit, research finding, or AI classification.
WATCHED = {
    'glen': 'boettiger-lab/geo-agent',
    'sparrow-engine': 'microsoft/SPARROW-Engine',
    'sparrow-comm': 'microsoft/SPARROW-Comm',
    'megadetector': 'agentmorris/MegaDetector',
    'speciesnet': 'google/cameratrapai',
    'perch': 'google-research/perch-hoplite',
    'naturelm': 'earthspecies/NatureLM-audio',
    'bioCLIP': 'Imageomics/bioclip',
    'deepforest': 'weecology/DeepForest',
    'prithvi': 'NASA-IMPACT/Prithvi-EO-2.0',
    'orcahello': 'orcasound/orcahello',
    'orcai': 'ethz-tb/orcAI',
    'qgis': 'qgis/QGIS',
}
SEARCHES = [
    'topic:biodiversity topic:machine-learning',
    'topic:bioacoustics topic:deep-learning',
    'topic:earth-observation topic:machine-learning',
    '"environmental monitoring" in:description',
    '"ecological monitoring" in:description',
    '"climate forecasting" in:description',
    '"marine conservation" in:description',
]
KEYWORDS = ('ecolog','environment','biodivers','wildlife','conserv','habitat',
            'species','forest','satellite','geospatial','earth observation',
            'climate','ocean','marine','whale','bioacoust','hydrolog',
            'water quality','flood','coastal','fish','coral','pollution',
            'renewable energy','remote sensing')
DOMAIN_HINTS = {
    'Biodiversity & wildlife': ('bird','species','biodivers','wildlife','forest animal','ecolog','conserv','habitat','bioacoust','camera trap','insect'),
    'Land & satellites': ('satellite','land cover','geospatial','earth observation','remote sensing','soil','deforest','gis','landscape'),
    'Climate & energy': ('climate','emission','carbon','solar','weather','renewable energy','energy','warming'),
    'Water & oceans': ('whale','marine','ocean','hydrolog','water','flood','coral','fish','coastal','aquatic'),
}
MAX_LEADS, MAX_RELEASES, LOOKBACK_DAYS = 120, 120, 90
MAX_SITE_PROBES = 16  # GitHub discovery: limited low-priority website checks.
MAX_DIRECTORY_PROBES = 32  # Bounded run with per-source and per-domain caps.
# Provider-curated tool listings, not generic search results or research papers.
DIRECTORIES = (
    ('Google Sustainability', 'https://sustainability.google/technology/tools/', ('explore tool',)),
    ('NASA Landsat data tools', 'https://science.nasa.gov/mission/landsat/data-overview/', ('explore',)),
    ('FathomNet solutions', 'https://www.fathomnet.org/solutions',
     ('go to fathomnet portal', 'go to fathomnet database', 'go to fathomverse')),
    ('Space for Climate Observatory', 'https://www.spaceclimateobservatory.org/tools/all/all',
     ('open the app', 'see the *', 'access the *', 'view the *',
      'see * demonstrator', 'see * platform')),
    ('WRI Aqueduct applications', 'https://www.wri.org/aqueduct/tools', ('launch tool',)),
    ('Open Foris applications', 'https://www.openforis.org/', ('launch *',)),
    ('Atlas of Living Australia services', 'https://www.ala.org.au/sites-and-services/',
     ('spatial portal', 'biocollect', 'fishmap', 'explore your area', 'species list')),
    ('EPA Ireland map services', 'https://gis.epa.ie/SeeMaps',
     ('water maps', 'epa maps', 'my local environment',
      'beaches.ie bathing water quality', 'environment & wellbeing')),
    ('Copernicus Marine services', 'https://data.marine.copernicus.eu/',
     ('myocean pro', 'myocean light', 'myocean health', 'explore viewer')),
)
# A provider-directory field cue is not a machine-learning or AI classification.
SOURCE_DOMAINS = {
    'WRI Aqueduct applications': 'Water & oceans',
    'Open Foris applications': 'Land & satellites',
    'Atlas of Living Australia services': 'Biodiversity & wildlife',
    'EPA Ireland map services': 'Water & oceans',
    'Copernicus Marine services': 'Water & oceans',
    'NASA Landsat data tools': 'Land & satellites',
    'FathomNet solutions': 'Water & oceans',
}
MAX_NEW_PER_SOURCE = 6
MAX_NEW_PER_DOMAIN = 12

# Product-like metadata is a filter, not proof that an application works.
TOOL_SIGNALS = (
    'interactive', 'dashboard', 'web app', 'webapp', 'viewer', 'explorer',
    'visualization', 'visualisation', 'online tool', 'map', 'mapping',
    'monitoring tool', 'analysis tool', 'decision support', 'application',
    'platform', 'live demo', 'demo', 'species identification', 'classification tool',
)
NOT_TOOL_SIGNALS = (
    'awesome-', 'awesome list', 'curated list', 'reading list', 'resources',
    'tutorial', 'course', 'assignment', 'homework', 'template', 'boilerplate',
    'paper collection', 'dataset collection', 'benchmark', 'literature review',
    'portfolio', 'github profile', 'link collection',
)
REJECTED_HOSTS = {
    'github.com', 'www.github.com', 'raw.githubusercontent.com',
    'gist.github.com', 'gitlab.com', 'www.gitlab.com',
    'youtube.com', 'www.youtube.com', 'x.com', 'twitter.com',
    'medium.com', 'www.medium.com', 'arxiv.org', 'doi.org',
    'huggingface.co', 'www.huggingface.co',
}



def text(s, maximum=350):
    return re.sub(r'[\x00-\x1f]+', ' ', str(s or '')).strip()[:maximum]


def api(path, params=None):
    url = 'https://api.github.com/' + path.lstrip('/')
    if params:
        url += '?' + urlencode(params)
    headers={'Accept':'application/vnd.github+json','User-Agent':'EnvAI-autoupdate/1.0',
             'X-GitHub-Api-Version':'2022-11-28'}
    token=os.getenv('GITHUB_TOKEN','').strip()
    if token:
        headers['Authorization']='Bearer '+token
    with urlopen(Request(url, headers=headers), timeout=13) as res:
        return json.load(res)


def domain_guess(haystack):
    s=haystack.lower()
    scores={key:sum(1 for x in hints if x in s) for key,hints in DOMAIN_HINTS.items()}
    # Distinctive ecological subjects take priority over generic methods
    # such as acoustic monitoring, which cross several environmental fields.
    for cue in ('whale','orca','marine','ocean','coral','coastal','fish'):
        if cue in s:scores['Water & oceans']+=3
    for cue in ('satellite','land cover','geospatial','earth observation'):
        if cue in s:scores['Land & satellites']+=2
    for cue in ('climate','emission','carbon','renewable energy'):
        if cue in s:scores['Climate & energy']+=2
    domain=max(scores, key=scores.get)
    return domain if scores[domain] else None


def valid_url(url):
    try:
        parsed=urlparse(url)
        return parsed.scheme=='https' and parsed.netloc.lower() in ('github.com','www.github.com')
    except (TypeError,ValueError):
        return False


def usable_homepage(value):
    """A direct website, not a code-hosting or article link."""
    try:
        u = urlparse(str(value or '').strip())
        host = (u.hostname or '').lower()
        if u.scheme != 'https' or not host or host in REJECTED_HOSTS:
            return None
        if host.endswith('.github.com') or host.endswith('.gitlab.com'):
            return None
        if host in ('localhost', '127.0.0.1') or host.endswith(('.localhost','.local','.internal','.lan','.test','.arpa')):
            return None
        if not ('.' in host) or u.username or u.password:
            return None
        # Disallow literal IP endpoints from untrusted repository metadata.
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            return None
        path=u.path.lower()
        if any(x in path for x in ('/blog/', '/news/', '/paper/', '/articles/')):
            return None
        return u.geturl()
    except (TypeError, ValueError):
        return None


def looks_like_tool(repo):
    """Exclude resource lists, experiments and repos with no product affordance."""
    title=text(repo.get('name'), 120).lower()
    desc=text(repo.get('description'), 350).lower()
    topics=' '.join(x for x in (repo.get('topics') or []) if isinstance(x,str)).lower()
    combined=' '.join((title, desc, topics))
    if any(word in combined for word in NOT_TOOL_SIGNALS): return False
    return any(word in combined for word in TOOL_SIGNALS)


def probe_live_site(url):
    """Best-effort HTTP reachability. Does NOT certify actual functionality.

    Only a short bounded GET is attempted; HTML pages and common interactive
    web interfaces are allowed. Sites that block automation are omitted, not
    declared broken. Redirects to a code host are rejected.
    """
    req=Request(url, headers={'User-Agent':'EnvAI-discovery/1.1',
                              'Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'},
                method='GET')
    try:
        with urlopen(req, timeout=5) as response:
            final=usable_homepage(response.geturl())
            code=response.status
            mime=str(response.headers.get('Content-Type','')).lower()
            if not final or not 200<=code<400: return False
            if not any(t in mime for t in ('text/html', 'application/xhtml+xml')):
                return False
            return True
    except (OSError, HTTPError, URLError, TimeoutError, ValueError, TypeError):
        return False



 
# Curated live applications catalogue with individual application landing pages.
# It exposes new launches even when their project has no GitHub repository.
COPERNICUS_APPS='https://apps.climate.copernicus.eu/'
COPERNICUS_APP_TITLES={
    'climate-pulse':'Climate Pulse',
    'era-explorer':'ERA Explorer',
    'climate-atlas':'Climate Atlas',
    'thermal-trace':'Thermal Trace',
    'methane-explorer':'Methane Hotspot Explorer',
    'european-climate-data-explorer':'European Climate Data Explorer',
    'fire-emissions-watch':'Fire Emissions Watch',
    'weather-replay':'Weather Replay',
    'global-temperature-trend-monitor':'Global Temperature Trend Monitor',
    'necd-explorer':'NECD Explorer',
    'aerosol-alerts':'Aerosol Alerts',
}

def normalized_title(value):
    """Deduplicate official catalogue aliases, without conflating distinct tools."""
    name=re.sub(r'^(copernicus|ecmwf|google)\s+', '', str(value or '').lower())
    name=name.replace('interactive climate atlas','climate atlas')
    return re.sub(r'[^a-z0-9]', '', name)

class CopernicusAppLinks(HTMLParser):
    """Discover official C3S/CAMS application detail links from live HTML."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._anchor=None
        self.items=[]

    def handle_starttag(self,tag,attrs):
        if tag=='a':
            self._anchor={'href':dict(attrs).get('href',''), 'text':[]}

    def handle_data(self,data):
        if self._anchor is not None:
            self._anchor['text'].append(data)

    def handle_endtag(self,tag):
        if tag!='a' or self._anchor is None:return
        raw=self._anchor
        self._anchor=None
        link=urljoin(COPERNICUS_APPS,raw['href'])
        parsed=urlparse(link)
        if parsed.hostname not in ('apps.climate.copernicus.eu',
                                   'apps.atmosphere.copernicus.eu'):
            return
        from urllib.parse import parse_qs
        if parsed.path.rstrip('/')!='/overview':return
        slug=parse_qs(parsed.query).get('app',[''])[0]
        if not re.fullmatch(r'[a-z0-9-]{3,90}',slug):return
        title=COPERNICUS_APP_TITLES.get(slug,slug.replace('-',' ').title())
        self.items.append((title,link,
                           text(' '.join(raw['text']),280)))


class OfficialToolLinks(HTMLParser):
    """Extract links explicitly labelled as tools from a trusted directory.

    The directory link itself is evidence of a listing, not of AI capability.
    We deliberately do not crawl general news, search results or arbitrary
    links found elsewhere on the same page.
    """
    def __init__(self, labels):
        super().__init__(convert_charrefs=True)
        self.labels = set(labels)
        self.heading = ''
        self._heading_parts = None
        self._anchor = None
        self._context = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag in ('h3', 'h4'):
            self._heading_parts = []
        elif tag == 'a':
            self._anchor = {'href': dict(attrs).get('href', ''), 'text': []}

    def handle_data(self, data):
        if self._heading_parts is not None:
            self._heading_parts.append(data)
        if self._anchor is not None:
            self._anchor['text'].append(data)
        elif self.heading and len(self._context) < 12:
            t = text(data, 180)
            if t:
                self._context.append(t)

    def handle_endtag(self, tag):
        if tag in ('h3', 'h4') and self._heading_parts is not None:
            self.heading = text(' '.join(self._heading_parts), 100)
            self._heading_parts = None
            self._context = []
        elif tag == 'a' and self._anchor is not None:
            label = text(' '.join(self._anchor['text']), 100).lower()
            matching = label in self.labels or any(
                label.startswith(pattern[:-1]) for pattern in self.labels
                if pattern.endswith('*') and len(pattern)>1)
            if matching:
                generic={'launch tool','visit website','explore','open the app'}
                if label in generic:
                    title=self.heading
                elif label.startswith('go to '):
                    title=label.removeprefix('go to ').title()
                elif label.startswith('launch '):
                    title=label.removeprefix('launch ').title()
                elif label.startswith(('see the ','access the ','view the ')):
                    title=self.heading or label.split(' ',2)[-1].title()
                else:
                    title=label.title()
                if 3 <= len(title) <= 100:
                    self.items.append((title, self._anchor['href'],
                                       text(' '.join(self._context), 280)))
            self._anchor = None


def fetch_directory(url):
    """Fetch a bounded HTML listing; an outage must not erase earlier leads."""
    request = Request(url, headers={'User-Agent': 'EnvAI-discovery/2.0',
                                    'Accept': 'text/html,application/xhtml+xml'})
    with urlopen(request, timeout=12) as response:
        if 'html' not in str(response.headers.get('Content-Type', '')).lower():
            raise ValueError('directory is not HTML')
        return response.read(1_000_000).decode('utf-8', errors='replace')


def health_check(url):
    """Returns (ok|missing|unknown, HTTP status).

    Only explicit 404/410 responses are evidence of disappearance. Timeouts,
    authentication, anti-bot blocks, redirects and server errors are not.
    """
    try:
        request = Request(url, headers={'User-Agent': 'EnvAI-health/1.0',
                                        'Accept': 'text/html,*/*;q=0.4'})
        with urlopen(request, timeout=6) as response:
            status = response.status
            if not 200 <= status < 400:
                return ('unknown', status)
            final_url = response.geturl()
            if urlparse(url).hostname not in ('github.com', 'www.github.com') \
                    and urlparse(final_url).hostname in ('github.com', 'www.github.com'):
                return ('unknown', status)
            return ('ok', status)
    except HTTPError as error:
        return ('missing' if error.code in (404, 410) else 'unknown', error.code)
    except (OSError, URLError, TimeoutError, ValueError, TypeError):
        return ('unknown', None)


def update_health(previous, catalogue, check, today):
    """Two confirmed missing results hide a tool, without deleting provenance."""
    existing = previous.get('toolHealth', {})
    if not isinstance(existing, dict):
        existing = {}
    health = {}
    for tool in catalogue['items']:
        if tool.get('toolUse') not in ('online', 'install', 'access'):
            continue
        tool_id, url = tool['id'], tool.get('url', '')
        if not url.startswith('https://'):
            continue
        prior = existing.get(tool_id, {})
        if not isinstance(prior, dict) or prior.get('url') != url:
            prior = {}
        state, code = check(url)
        if state == 'missing':
            misses = int(prior.get('consecutiveMissing', 0)) + 1
            visible_state = 'retired' if misses >= 2 else 'suspect'
        elif state == 'ok':
            misses, visible_state = 0, 'reachable'
        else:
            # A timeout must not resurrect a previously confirmed dead link.
            retired = prior.get('state') == 'retired'
            misses = int(prior.get('consecutiveMissing', 0)) if retired else 0
            visible_state = 'retired' if retired else 'unconfirmed'
        health[tool_id] = {
            'url': url, 'state': visible_state,
            'consecutiveMissing': misses,
            'lastCheckedAt': today.isoformat(),
            'httpStatus': code,
            'lastReachableAt': (today.isoformat() if state == 'ok'
                               else prior.get('lastReachableAt')),
        }
    return health


def parse_stamp(s):
    raw=text(s,30)[:10]
    try:
        return dt.date.fromisoformat(raw)
    except ValueError:
        return None


def watched_repositories(catalogue):
    """Auto-watch approved tools whose project URL identifies one GitHub repo.

    The small explicit watchlist additionally covers project sites not hosted at
    a GitHub URL in the catalogue. Unknown candidate repos are not auto-watched
    as approved release sources.
    """
    watched={key:repo for key,repo in WATCHED.items() if any(t.get('id')==key for t in catalogue['items'])}
    for t in catalogue['items']:
        try:
            p=urlparse(str(t.get('url') or ''))
            if p.scheme!='https' or p.netloc.lower()!='github.com':continue
            path=p.path.strip('/').removesuffix('.git')
            if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',path):continue
            watched.setdefault(t['id'],path)
        except (ValueError,KeyError):pass
    return watched


def existing_state():
    if DATA_PATH.exists():
        try:return json.loads(DATA_PATH.read_text(encoding='utf8'))
        except (ValueError,OSError):pass
    return {'schemaVersion':1,'releaseEvents':[],'leads':[]}


def scan(*, fetch=api, probe=probe_live_site, directory_fetch=None,
         health_probe=None, today=None, previous=None, catalogue=None):
    today=today or dt.datetime.now(dt.timezone.utc).date()
    previous=previous if previous is not None else existing_state()
    catalogue=catalogue if catalogue is not None else json.loads(TOOLS_PATH.read_text(encoding='utf8'))
    curated={t['id']:t for t in catalogue['items']}
    watched=watched_repositories(catalogue)
    indexed_urls={text(t.get('url')).lower().rstrip('/') for t in catalogue['items']}
    old_rel={ev['id']:ev for ev in previous.get('releaseEvents',[]) if 'id' in ev}
    # Drop historical repo-only noise from the public feed. Preserve useful
    # direct-tool candidates from previous scans instead of re-adding them.
    old_leads={ev['id']:ev for ev in previous.get('leads',[])
               if ev.get('id') and ev.get('accessType')=='web'
               and usable_homepage(ev.get('url')) and ev.get('siteReachable') is True}
    cutoff=today-dt.timedelta(days=LOOKBACK_DAYS)
    sources_ok=0;sources_failed=0
    new_release_count=0;new_lead_count=0
    sites_probed=0
    errors=[]

    def get(path,params=None):
        nonlocal sources_ok,sources_failed
        try:
            payload=fetch(path,params)
            if payload is None: raise ValueError('empty API response')
            sources_ok+=1
            return payload
        except (OSError,HTTPError,URLError,TimeoutError,ValueError,TypeError) as e:
            sources_failed+=1;errors.append(text(path+' / '+str(e),180))
            return None

    for tool_id, repo in watched.items():
        if tool_id not in curated:
            errors.append('Watch list missing catalogued tool: '+tool_id)
            continue
        releases=get(f'/repos/{repo}/releases',{'per_page':8})
        if not isinstance(releases,list):continue
        count=0
        for release in releases:
            if release.get('draft'):continue
            stamped=parse_stamp(release.get('published_at'))
            if not stamped or not cutoff<=stamped<=today:continue
            url=text(release.get('html_url'),500)
            if not valid_url(url):continue
            tag=text(release.get('tag_name') or release.get('name'),90)
            if not tag:continue
            event_id='release:'+repo.lower()+':'+tag.lower()
            event={'id':event_id,'toolId':tool_id,'title':curated[tool_id]['title'],
                   'tag':tag,'eventDate':stamped.isoformat(),'eventType':'Official GitHub release'+(' (pre-release)' if release.get('prerelease') else ''),
                   'url':url,'evidence':url,'source':'GitHub release / '+repo,
                   'summary':'A source-dated release from the project’s watched GitHub repository. Features and impact are not independently assessed.',
                   'aiType':curated[tool_id].get('aiType','Unverified')}
            if event_id not in old_rel:new_release_count+=1
            old_rel[event_id]=event
            count+=1
            if count>=3:break

    created_cutoff=today-dt.timedelta(days=21)
    seen_homepages={url.lower().rstrip('/') for url in indexed_urls}
    seen_homepages.update(x['url'].lower().rstrip('/') for x in old_leads.values())

    # Authoritative, explicitly labelled tool directories are prioritised over
    # newly created repositories. A listing yields a candidate, not approval.
    directory_probes = 0
    domain_additions = {field:0 for field in DOMAIN_HINTS}
    indexed_titles = {normalized_title(t.get('title'))
                      for t in catalogue['items']}
    indexed_titles.update(
        normalized_title(x.get('title'))
        for x in old_leads.values())
    if directory_fetch is not None:
        # The application-listing crawl detects newly published Copernicus apps.
        # This is a discovery *candidate* feed, never automatic classification.
        source_name='Copernicus C3S/CAMS applications'
        try:
            html=directory_fetch(COPERNICUS_APPS)
            parser=CopernicusAppLinks()
            parser.feed(html)
            if not parser.items:
                raise ValueError('No application links found (directory layout may have changed)')
            sources_ok+=1
            for title,detail_url,description in parser.items:
                if directory_probes>=MAX_DIRECTORY_PROBES or domain_additions['Climate & energy']>=MAX_NEW_PER_DOMAIN:break
                homepage=usable_homepage(detail_url)
                title_key=normalized_title(title)
                if not homepage or title_key in indexed_titles or (
                    homepage.lower().rstrip('/') in seen_homepages):continue
                directory_probes+=1
                if not probe(homepage):continue
                entry_id='directory:copernicus:' + urlparse(homepage).query.split('app=')[-1]
                old_leads[entry_id]={
                    'id':entry_id,'title':title,'url':homepage,'evidence':COPERNICUS_APPS,
                    'discoveredAt':today.isoformat(),'eventDate':today.isoformat(),
                    'note':'Official Copernicus climate/atmosphere application listing. '
                          'Open its detail page to launch the application. '
                          'Website reachable; functionality and AI status not independently verified.',
                    'source':source_name,
                    'status':'official application candidate / functionality unverified',
                    'domain':'Climate & energy','aiType':'Unverified',
                    'accessType':'web','siteReachable':True,
                    'siteCheckedAt':today.isoformat(),'tags':['copernicus','climate'],
                }
                seen_homepages.add(homepage.lower().rstrip('/'))
                indexed_titles.add(title_key)
                new_lead_count+=1
                domain_additions['Climate & energy']+=1
        except (OSError,HTTPError,URLError,TimeoutError,ValueError,TypeError) as error:
            sources_failed+=1
            errors.append(text(source_name+' / '+str(error),180))
        for source_name, source_url, labels in DIRECTORIES:
            try:
                html = directory_fetch(source_url)
                parser = OfficialToolLinks(labels)
                parser.feed(html)
                sources_ok += 1
            except (OSError, HTTPError, URLError, TimeoutError, ValueError, TypeError) as error:
                sources_failed += 1
                errors.append(text(source_name + ' / ' + str(error), 180))
                continue
            source_additions=0
            for title, link_url, description in parser.items:
                if directory_probes >= MAX_DIRECTORY_PROBES or source_additions>=MAX_NEW_PER_SOURCE:
                    break
                homepage = usable_homepage(urljoin(source_url, link_url))
                title_key = normalized_title(title)
                if not homepage or title_key in indexed_titles:
                    continue
                if homepage.lower().rstrip('/') in seen_homepages:
                    continue
                combined = (title + ' ' + description).lower()
                domain = SOURCE_DOMAINS.get(source_name) or domain_guess(combined)
                if not domain or domain_additions[domain]>=MAX_NEW_PER_DOMAIN:
                    continue
                directory_probes += 1
                if not probe(homepage):
                    continue
                entry_id = 'directory:' + re.sub(r'[^a-z0-9]+', '-', source_name.lower()).strip('-') + ':' + title_key
                old_leads[entry_id] = {
                    'id': entry_id, 'title': title, 'url': homepage,
                    'evidence': source_url, 'discoveredAt': today.isoformat(),
                    'eventDate': today.isoformat(),
                    'note': (description or 'Listed in an official environmental tools directory.') +
                            ' · Listed tool website reachable; functionality and AI classification not yet verified.',
                    'source': source_name + ' / official tool directory',
                    'status': 'official-directory candidate / functionality unverified',
                    'domain': domain, 'aiType': 'Unverified', 'accessType': 'web',
                    'siteReachable': True, 'siteCheckedAt': today.isoformat(),
                    'tags': ['official-directory'],
                }
                seen_homepages.add(homepage.lower().rstrip('/'))
                indexed_titles.add(title_key)
                new_lead_count += 1
                source_additions += 1
                domain_additions[domain] += 1

    for q in SEARCHES:
        result=get('/search/repositories',{'q':q+' created:>='+created_cutoff.isoformat(),
                                           'sort':'updated','order':'desc','per_page':14})
        if not isinstance(result,dict):continue
        for repo in result.get('items',[]):
            if sites_probed>=MAX_SITE_PROBES:break
            if repo.get('fork') or repo.get('archived') or repo.get('disabled'):continue
            created=parse_stamp(repo.get('created_at'))
            if not created or created>today or created<created_cutoff:continue
            fullname=text(repo.get('full_name'),150)
            name=text(repo.get('name'),100)
            desc=text(repo.get('description'),300)
            topics=' '.join(x for x in (repo.get('topics') or []) if isinstance(x,str))[:220]
            combined=(name+' '+desc+' '+topics).lower()
            if not any(k in combined for k in KEYWORDS):continue
            domain=domain_guess(combined)
            if domain is None or not looks_like_tool(repo):continue
            homepage=usable_homepage(repo.get('homepage'))
            if not homepage or homepage.lower().rstrip('/') in seen_homepages:continue
            evidence=text(repo.get('html_url'),500)
            if not valid_url(evidence):continue
            entry_id='candidate:'+fullname.lower()
            if entry_id in old_leads:continue
            # A homepage listed in GitHub metadata can be a dead landing page:
            # check reachability before putting it in visitors' results.
            sites_probed+=1
            if not probe(homepage):continue
            lead={
                'id':entry_id,
                'title':name.replace('-', ' ').replace('_',' ').strip()[:100] or fullname,
                'url':homepage,  # Primary action opens the tool, NOT GitHub.
                'evidence':evidence,  # GitHub remains an evidence/source link.
                'discoveredAt':today.isoformat(),
                'eventDate':created.isoformat(),
                'note':(desc or 'Interactive environmental tool candidate.')+
                       ' · Linked website was reachable at discovery, but functionality and claims are unverified.',
                'source':'GitHub project metadata + reachable tool website',
                'status':'live-site candidate / functionality not verified',
                'domain':domain,'aiType':'Unverified',
                'accessType':'web','siteReachable':True,'siteCheckedAt':today.isoformat(),
                'tags':[t for t in (repo.get('topics') or []) if isinstance(t,str)][:8],
            }
            old_leads[entry_id]=lead
            seen_homepages.add(homepage.lower().rstrip('/'))
            new_lead_count+=1

    def retain(row):
        day=parse_stamp(row.get('eventDate') or row.get('discoveredAt'))
        return day is not None and day>=cutoff and day<=today
    releases=sorted((e for e in old_rel.values() if retain(e)),key=lambda e:(e['eventDate'],e['id']),reverse=True)[:MAX_RELEASES]
    # Reserve equal retention capacity per environmental field. A busy source
    # must not evict all water, biodiversity or land discoveries.
    ordered=sorted((e for e in old_leads.values() if retain(e)),
                   key=lambda e:(e.get('discoveredAt',''),e['id']),reverse=True)
    per_field={field:0 for field in DOMAIN_HINTS}
    leads=[]
    unassigned=[]
    for entry in ordered:
        field=entry.get('domain')
        if field not in per_field:
            # Preserve historical, validated website leads with no field metadata.
            # They remain unclassified and cannot enter a field constellation.
            unassigned.append(entry)
            continue
        if per_field[field]>=MAX_LEADS//len(per_field):
            continue
        leads.append(entry)
        per_field[field]+=1
        if len(leads)>=MAX_LEADS:
            break
    leads.extend(unassigned[:max(0, MAX_LEADS-len(leads))])
    status='ok' if sources_ok and not sources_failed else 'partial' if sources_ok else 'error'
    tool_health = (update_health(previous, catalogue, health_probe, today)
                   if health_probe else previous.get('toolHealth', {}))
    result={'schemaVersion':1,'sourceMode':'scheduled-multi-source-tools',
            'lastAttemptAt':today.isoformat(),'lastSuccessAt':today.isoformat() if sources_ok else previous.get('lastSuccessAt'),
            'scanStatus':status,'sourcesChecked':sources_ok+sources_failed,
            'sourcesSucceeded':sources_ok,'sourcesFailed':sources_failed,
            'monitorCount':len(watched),'errorSummary':errors[:4],
            'releaseEvents':releases,'leads':leads,'sitesProbed':sites_probed,
            'directorySitesProbed':directory_probes,'toolHealth':tool_health,
            'candidateCountByField':{field:sum(1 for e in leads if e.get('domain')==field)
                                     for field in DOMAIN_HINTS},
            'catalogueCountByField':{field:sum(1 for t in catalogue['items']
                               if t.get('domain')==field and t.get('toolUse')
                               in ('online','install','access')) for field in DOMAIN_HINTS},
            'notice':'Official directories and GitHub are checked daily. Candidates remain unverified. Tools with two confirmed missing-link scans are hidden from the public atlas, not deleted from research records.',
           }
    return result, {'releasesAdded':new_release_count,'leadsAdded':new_lead_count,'sourcesSucceeded':sources_ok,'sourcesFailed':sources_failed}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run',action='store_true',help='Preview result without writing live data')
    args=parser.parse_args()
    result,stats=scan(directory_fetch=fetch_directory, health_probe=health_check)
    if args.dry_run:
        print(json.dumps({'stats':stats,'status':result['scanStatus'],'sampleReleases':result['releaseEvents'][:2],
                          'sampleLeads':result['leads'][:2]},indent=2))
        return
    DATA_PATH.parent.mkdir(parents=True,exist_ok=True)
    original=DATA_PATH.read_text(encoding='utf8') if DATA_PATH.exists() else None
    out=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if out!=original: DATA_PATH.write_text(out,encoding='utf8')
    print(f"EnvAI auto-update: {result['scanStatus']} | {stats} | now {len(result['releaseEvents'])} watched releases and {len(result['leads'])} website-backed tool candidates")
    if not result['sourcesSucceeded']:
        print('All sources failed; preserving previously known events. Check GitHub API and workflow permissions.',file=sys.stderr)
        sys.exit(1)

if __name__=='__main__':main()
