# MetaForma — Canonical Metaphysical Mannequin
**Art-direction specification v1.0 | 23 October 2026 | STATUS: DESIGN GATE, NOT APPROVED AS AN ASSET**

## The essential requirement
Create a **recognisably de Chirico-inspired metaphysical mannequin**, not a conventional artist's drawing doll, wooden robot, skeleton, generic low-poly human, fitness-game avatar, or polished toy.

The figure must evoke the **faceless, architectural, assembled, disquieting mannequin** of *Il trovatore* and *Hector and Andromache*: part sculpture, part tailoring dummy, part constructed painting.

The earlier procedural Three.js character in this pull request is **REJECTED**. Its assembled spheres/cylinders, blue oval torso and metallic-ball joints do not pass this design standard. **Do not merge the prototype as an approved visual design.**

### Primary art-historical anchors
- Museum Boijmans Van Beuningen, *Il trovatore*: https://www.boijmans.nl/en/collection/artworks/101582/il-trovatore — egg-shaped blank head; torso made from coloured wooden boards of varying sizes; black turned knobs in place of shoulders; theatrical red/blue drape; monumental scale against architecture.
- Irish Museum of Modern Art, *Il Trovatore*: https://imma.ie/collection/il-trovatore/ — a figure part flesh, part articulated artist's model, with angular drafting-tool elements.
- MoMA on de Chirico: https://www.moma.org/artists/1106-giorgio-de-chirico — sun-bleached arcades, sharp shadows, simplified architecture and uneasy spatial perspective.

These are **visual references**, not assets to copy or embed. Create original meshes, original textures and original compositions. Exact painting facsimiles are not required or desirable.

## 1. The single canonical character: MF-01 / IL GESTO

### Silhouette — mandatory
- Tall and stately rather than anatomically generic; strong upper-body visual mass tapering towards the waist.
- A slightly enlarged, smoothly ovoid head with no face whatsoever: **no eyes, mouth, nose, ears, eyebrows or hair**. No cartoon/emotive features.
- Head is subtly asymmetric, like an aged plaster or ivory-resin sculpture, not a perfect white sphere or a porcelain robot.
- The neck is a simple dark wooden or carved spindle, partly hidden beneath the chest construction.
- Torso looks **constructed from irregular layered, angular painted boards**, some triangular or trapezoidal, asymmetrically overlapping. The torso must read like metaphysical assemblage and a painter's easel at first glance.
- Two visible **black, lathe-turned, ribbed circular shoulder bosses**. These are a defining motif; never render them as smooth metallic spherical ball joints.
- Arms and legs are sculpted tapered lobes of faded ochre/terracotta-painted wood with subtle seam lines. Where necessary, pivot mechanics are visually concealed behind painted collars.
- Hands: simplified elongated wedge-palms capable of making credible floor contact. No mitten blobs and no robotic articulated fingers.
- Feet: tapered sculptural lasts able to lie flat on mat; no sneakers or hyperreal toes.
- One asymmetrical **folded red/ultramarine cloth** can emerge from behind the torso and be optionally hidden for mat exercises. Its fold language is theatrical, not superhero/cape physics.

### Surfaces
- Aged, uneven **oil-painted matte** surfaces, visible fine wood grain, rubbed edges, small incised circles or spiral marks, subtle pencil/drafting-line motifs on chest boards.
- Selective dark patina in joints; no photoreal skin, polished plastic, chrome, exposed wires or brushed-metal android materials.
- Separate materials should suggest tempera-painted timber, ivory gesso, dark stained turned wood, muted blue painted board and terracotta wood.

### Palette — a constrained starting point
| Motif | Suggested colour | Hex |
|---|---|---|
| Egg-head / gesso | ivory, warm and imperfect | `#D8C6A1` |
| Tapered limbs | ochre wood | `#A86F45` |
| Sculpted thighs and drapery | burnt terracotta | `#A34D35` |
| Chest geometric panels | oxidised grey-green | `#526B68` |
| Select accent | Prussian / ultramarine blue | `#334E70` |
| Shoulder rosettes | near-black aged wood | `#2B2927` |
| Fine markings / aged metal | dull antiqued brass | `#9B7746` |

Colours should feel painted into the scene, not emitted as UI/neon elements.

## 2. Stage: a painted metaphysical piazza
- An empty, silent, impossible Italian piazza, **not** a modern Pilates studio or futuristic gym.
- Geometrically severe arcades, distant brick tower or blank masonry wall, unnaturally deep perspective, very low horizon.
- Warm apricot/ochre ground; deep moss-to-blue-green sky; one stark sun, strong chiaroscuro and elongated angled cast shadow.
- One small inexplicable geometric object at the scene edge: an obelisk, plinth, ball or drafting triangle. It must not compete with the mannequin.
- Keep the exercise mat as an unobtrusive period-appropriate dark painted platform, not a neon-outlined fitness mat.
- Camera composition: a quiet theatrical tableau. Sculptural lighting and slightly non-natural perspective take priority over realism.
- **The complete mannequin must remain in frame** through all poses; no cropped hands, feet or head.

## 3. Motion: hidden rig, visible sculpture
Motion has to communicate Pilates clearly without turning the figure into a generic humanoid. The engineering skeleton and constraints stay internal; the visible surface is the canonical sculptural character.

- Rig minimum: articulated shoulders, elbows, wrists, hips, knees, ankles, head/neck, pelvis and **at least three independently controllable spinal sections** (lumbar/thoracic/cervical). This is vital for Roll Up and similar articulation.
- Keep the egg-head, shoulder rosettes, painted chest-board assembly and material colours consistent across all movements.
- Turned-wood shoulder bosses follow scapular/upper-arm movement without floating or shearing unnaturally.
- Allow the chest's overlapping boards to slide/hinge **subtly** during spinal flexion; no inexplicable rubber bending.
- Hard constraints: feet, hands and pelvis stay in contact where the exercise requires; no penetrating limbs, floating feet, collapsing mesh or extreme inverse-kinematics twists.
- Each animated movement needs an actual exercise-specific, reference-checked motion arc. A generic oscillation or swapping arbitrary joint coordinates is not Pilates.
- Movement should be measured and rhythmic, with pauses and deliberate transitions, never frantic, game-like, puppet-on-strings twitching.
- Keep model movement and camera movement separate, so teachers can pause, orbit and scrutinise.
- Visual accuracy is not proof of anatomical accuracy. Identify all sequences as **artistic studies awaiting instructor review** until independently checked.

## 4. Prohibitions / immediate rejection criteria
- **NO** spherical toy-ball joints connecting cylindrical arms.
- **NO** bare Three.js primitive-stick human as the finished character.
- **NO** glowing graphics, sci-fi visor, metallic android, mannequin shop dummy, low-poly exercise app aesthetic.
- **NO** cute faces, exposed teeth, eyes, eyebrows, hair or expressive human face.
- **NO** 34 fake 'animated' exercises using one generic motion loop.
- **NO** generic 3D model substituted solely because its joint system is easy to animate.
- **NO** partial-frame cropping of head, hands, feet or limbs.
- **NO** portrayal of unverified advanced inversions as safe instruction.

## 5. Approval sequence — stop at each gate
1. **MF-01 standing still:** front, 3/4 and profile still renders of the **same mesh** in the metaphysical piazza. At this point no Pilates choreography.
2. **Visual sign-off:** compare the silhouette, torso, black rosettes, head, material treatment and stage with the museum references. If the figure does not read as de Chirico-inspired within five seconds, reject it.
3. **Four still poses from the approved same 3D asset:** standing, seated, supine and a controlled Pilates position. No shape-switching between exercises.
4. **One animation only:** choose Hundred or Roll Up. Require anatomically meaningful key poses, smooth transitions, complete visibility from multiple views, and teacher review.
5. **Three more pilot exercises** using the same approved character and rig.
6. **All 34** only after an exercise-to-animation quality ledger and approval criteria exist for each.

## 6. Acceptance checklist
- [ ] Distinctive faceless elongated egg head.
- [ ] Asymmetrical painted-board, geometry-rich torso; not a smooth sphere or vest.
- [ ] Turned black shoulder rosettes.
- [ ] Tapered non-robotic carved limbs and sensible palms/feet.
- [ ] 100% recognisable silhouette when rendered in flat black.
- [ ] Aged matte painterly surfaces and restricted palette.
- [ ] Strong oblique shadow and quiet, impossible architectural stage.
- [ ] Complete body in frame in front, 3/4 and profile views.
- [ ] No obvious collision/interpenetration of mesh in test poses.
- [ ] Art approval granted **before** any exercise animation is promoted or catalogue count increased.
- [ ] Pilates movement accuracy reviewed separately by a qualified teacher.

### Implementation note
Replace the old character asset and stage code **from the character-design level**, not by recolouring the existing ball-and-cylinder geometry. Reuse only non-visual infrastructure that is independently sound, such as the catalogue schema, navigation or playback controls. The existing 15 animations should be classified as **unvalidated sketches**, not completed instructional demonstrations.
