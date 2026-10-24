# MetaForma — anatomy-first illustration protocol
**Version:** 1.0 · 24 October 2026  
**Status:** Mandatory production procedure; not a claim of instructor validation.

## Objective
Create artful de Chirico-inspired *static* marionette plates of the original 34 classical Pilates exercises, while preventing anatomy inventions. The image generator is not an anatomy engine. **Never infer a pose from an illustration.**

## Source hierarchy and audit
1. Joseph H. Pilates and William J. Miller, *Return to Life Through Contrology* (1945): exercise identity, sequence and originally described action. A modern revised transcription can aid lookup; record its edition.
2. Lesley Logan / Online Pilates Classes' individual mat exercise tutorial (human demonstration and teaching commentary), linked for every entry in `evidence.json`.
3. Other experienced classical Pilates instructors to resolve variations; clearly label modern modifications instead of silently substituting them.
4. Artist / biomechanics reviewer: **only actual, named approval** sets an approval flag. Automated rig tests never substitute for this step.

For EACH exercise create a `anatomy/NN-exercise.md` record before generating artwork:
- Source URLs, edition details, whether full video was actually viewed, and timecodes/stills inspected.
- Explicit initial/support/contact position, hip-pelvis-spine alignment, shoulder/elbow/wrist placement, knee/ankle/toe orientation.
- Key pose definitions. Three poses minimum; four or more when the original includes opening/closing and a controlled return.
- Motion direction and the movement that reverses it (even though animation is paused).
- Known classical variants and restrictions; name and source any modification.
- Comparison screenshots or private study references where legally appropriate; do not publish third-party photos without rights.
- Independent mechanical and classical teacher reviews, dated and attributable; no auto-filled approvals.

## Anatomical modelling workflow
1. **Observe a real human demonstration.** Describe the actual positions without hallucinating intermediate joints. Record uncertainties.
2. **Build one constant-length segmented skeleton.** Name hip joint / greater trochanter, pelvis, lumbar and thoracic spine, cervical chain, shoulders, elbow, wrists, knees, ankles and feet. Use a recognised anatomical coordinate system.
3. **Pose the skeleton, then attach skin/wood surfaces.** The approved metaphysical mannequin is a single continuous 3D character surface with hidden articulation, not twelve separately redrawn puppets.
4. **Apply constraints.** Joint motion limits, continuous spine curve, nonintersecting geometry, plausible weight support and mat contacts, no rotated/disconnected feet. Protect the cervical region where indicated.
5. **Lock the camera and the architectural set for all frames of one sequence.** Pixel-identical environment; only the mannequin pose changes. Different exercises may have different piazzas/stages.
6. **Render each keyframe from the same model and same camera.** De Chirico-inspired oil-painting look may be applied to a verified posed render, not substituted for the underlying geometry. Place labels in HTML/CSS, not in generated art.
7. **Compare reference and render side by side.** Audit by anatomical landmarks with an overlay / silhouette. Reject wrong movement identity, body orientation, limb length, toes/feet, contact and any cropping.
8. **Request qualified classical Pilates instructor review** before approving instructional exercise art.

## Automated checks: necessary, never sufficient
- Same rig/model ID, viewpoint/camera pose, background hash across every frame within an exercise.
- Constant lengths and connective topology: head–neck–spine–pelvis–hip–knee–ankle–foot.
- Mat support and contact points per documented stage; no unsupported body weight on head/neck.
- Foot alignment relative to shin (no 180-degree inversion), left/right markers maintained.
- Keyframe file coverage; labels, source links and review fields present.
- No exercise card rendered as `approved` without reference frames, biomechanics and named teacher review.
- Reject wrong exercise identity regardless of apparent beauty.

## Release logic
`exercise.source.titleChecked` permits displaying a **link**. It does NOT permit representing original marionette pose artwork as verified. No source frames + no expert review = **art withheld**.

## Defect log from rejected images
- Roll Over: pelvis and femora assembled in an impossible orientation, neck loaded, no coherent spine, feet incorrectly rotated; back/hip topology not continuous.
- Other plates: Neck Pull, High Bicycle, Crab, Control Balance misrepresented; defective feet and joints.
- Earlier animated generic proxy did not match the approved artistically coherent marionette.

## Backdrop rule
**One identical metaphysical piazza per exercise sequence** (camera, lighting, geometry and shadows). The background may vary *between exercises* or between chapters, never inside its START / MIDDLE / FINISH frames.

## Evidence to collect next
For exercise 03 Roll Over, obtain human reference frames with source and timecodes, construct a skeleton for the four classical phases, and arrange instructor review. No attempt to generate a new polished image until those tests pass.
