/* Original Week 6 practice questions based on authorised lecture slides. No private originals or Moodle wording. */
window.D4B_W6=Object.freeze({
  "curriculum": {
    "GEN": [
      "Generative Media: Images, Audio, Video and Responsibility"
    ]
  },
  "questions": [
    {
      "id": "d4b-128",
      "module": "GEN",
      "week": 6,
      "topic": "Latent diffusion",
      "stem": "Why do latent diffusion models denoise a compressed image representation rather than repeatedly denoise full-resolution pixels?",
      "choices": [
        "It guarantees perfect rendering of text in every image",
        "It reduces the computational burden before the decoder reconstructs the image",
        "It eliminates the need for training images",
        "It turns diffusion into an audio codec"
      ],
      "correct": 1,
      "explanation": "The image encoder compresses the image; denoising runs in the lower-dimensional latent space and the decoder reconstructs pixels afterwards. This is more computationally efficient, not a guarantee of fidelity.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Latent diffusion",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / Latent diffusion",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://arxiv.org/abs/2112.10752",
        "locator": "Rombach et al. (2022), High-Resolution Image Synthesis with Latent Diffusion Models, abstract: pretrained autoencoder latent-space diffusion reduces computational requirements",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slides 17–18",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 1,
        "distractor_indices_checked": [
          0,
          2,
          3
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Latent diffusion",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    },
    {
      "id": "d4b-129",
      "module": "GEN",
      "week": 6,
      "topic": "Random seed in image generation",
      "stem": "A team keeps the prompt, model and guidance fixed but changes the image-generation seed. What is the most direct expected effect?",
      "choices": [
        "The starting random noise changes, so the generated image can change",
        "The guidance scale necessarily increases",
        "The model switches from diffusion to a GAN",
        "The result is certified to be factually accurate"
      ],
      "correct": 0,
      "explanation": "The seed controls random initialisation. Holding other settings fixed while changing the seed changes the starting noise, not the model architecture or truthfulness of the result.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Random seed in image generation",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / Random seed in image generation",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://poloclub.github.io/diffusion-explainer/",
        "locator": "Lee et al., Diffusion Explainer, What can we change? Seed controls initial random noise; guidance controls prompt adherence",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slides 25–30; notebook A2",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 0,
        "distractor_indices_checked": [
          1,
          2,
          3
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Random seed in image generation",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    },
    {
      "id": "d4b-130",
      "module": "GEN",
      "week": 6,
      "topic": "MusicGen audio tokens",
      "stem": "How does MusicGen produce a short piece of music from a written description?",
      "choices": [
        "It retrieves a single fixed recording matching the prompt",
        "It directly edits every recorded waveform sample using a GAN discriminator",
        "It generates compressed discrete audio tokens that a codec decoder converts into sound",
        "It uses a text-to-speech vocoder to pronounce the prompt"
      ],
      "correct": 2,
      "explanation": "MusicGen conditions a language model on the description and generates discrete compressed audio-token streams. A neural audio codec decoder reconstructs the waveform; this is not mere retrieval or spoken text.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, MusicGen audio tokens",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / MusicGen audio tokens",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://arxiv.org/abs/2306.05284",
        "locator": "Copet et al. (2023), Simple and Controllable Music Generation, abstract: transformer language model over compressed discrete audio streams",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slides 38–41; notebook A6",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 2,
        "distractor_indices_checked": [
          0,
          1,
          3
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, MusicGen audio tokens",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    },
    {
      "id": "d4b-131",
      "module": "GEN",
      "week": 6,
      "topic": "Video spacetime patches",
      "stem": "In the 2024 Sora technical description, what allows a diffusion transformer to represent motion across a video?",
      "choices": [
        "Repeating one static frame without temporal information",
        "Converting only the narration into phoneme tokens",
        "Applying fixed physics rules to every object",
        "Processing patches of compressed visual data that span space and time"
      ],
      "correct": 3,
      "explanation": "Sora represents compressed visual data as spacetime patches and applies a diffusion transformer. Temporal structure matters because frames must remain coherent as objects move.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Video spacetime patches",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / Video spacetime patches",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://openai.com/index/video-generation-models-as-world-simulators/",
        "locator": "OpenAI (2024), Video generation models as world simulators, introduction and spacetime-patch representation",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slides 48–51",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 3,
        "distractor_indices_checked": [
          0,
          1,
          2
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Video spacetime patches",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    },
    {
      "id": "d4b-132",
      "module": "GEN",
      "week": 6,
      "topic": "CLIP similarity and validation",
      "stem": "A campaign tool uses CLIP to select the generated picture most similar to its text prompt. What remains necessary before publication?",
      "choices": [
        "Nothing: the highest similarity score proves the advertised product claims",
        "Human checks of factual claims, visual details and suitability; CLIP scores semantic alignment, not truth",
        "Only a larger random seed",
        "Replacing the text prompt with the model's confidence score"
      ],
      "correct": 1,
      "explanation": "CLIP measures learned image–text correspondence. A good score does not independently establish whether product claims are accurate, whether a logo is correct or whether the image is suitable to publish.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, CLIP similarity and validation",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / CLIP similarity and validation",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://arxiv.org/abs/2103.00020",
        "locator": "Radford et al. (2021), Learning Transferable Visual Models From Natural Language Supervision, abstract and broader impacts: image–text matching and task-specific limitations",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slides 20–22 and 62; notebook B2.1–B2.3",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 1,
        "distractor_indices_checked": [
          0,
          2,
          3
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, CLIP similarity and validation",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    },
    {
      "id": "d4b-133",
      "module": "GEN",
      "week": 6,
      "topic": "Individual versus collective creativity",
      "stem": "Which conclusion best reflects Doshi and Hauser's experiment on AI-assisted short-story writing?",
      "choices": [
        "AI assistance improved some individual evaluations while AI-assisted stories became more similar to one another",
        "Every AI-assisted story was less creative than every human-only story",
        "The study proved that all visual art becomes less diverse when AI is used",
        "AI assistance removed the need to assess creative work"
      ],
      "correct": 0,
      "explanation": "The study reported gains in evaluated story quality, particularly for less creative writers, alongside reduced diversity across AI-assisted stories. Its short-story design does not establish the same effect in every medium.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Individual versus collective creativity",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / Individual versus collective creativity",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://doi.org/10.1126/sciadv.adn5290",
        "locator": "Doshi & Hauser (2024), Science Advances, abstract and discussion: individual creativity gains with reduced collective novelty",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slide 56",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 0,
        "distractor_indices_checked": [
          1,
          2,
          3
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Individual versus collective creativity",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    },
    {
      "id": "d4b-134",
      "module": "GEN",
      "week": 6,
      "topic": "Content provenance limits",
      "stem": "An online image has no detectable Content Credentials or watermark. Which conclusion is justified?",
      "choices": [
        "The image must be a genuine unedited camera photograph",
        "The image must have been generated by a model",
        "Its factual claims have already been independently verified",
        "No supported provenance mark was detected; absence alone does not establish how the image was created"
      ],
      "correct": 3,
      "explanation": "Content Credentials are opt-in signed provenance records, not universal truth detectors. A missing or stripped credential cannot prove that an image is human-made, synthetic or factually correct.",
      "source": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Content provenance limits",
      "origin": "booklet-derived",
      "verification": "verified",
      "evidence": {
        "source": "Original private D4B Generative AI Week 6 lecture slides / Content provenance limits",
        "originalMaterialChecked": true,
        "review_type": "original-lecture-and-independent-primary-source",
        "reviewed_at": "2026-10-13",
        "url": "https://spec.c2pa.org/specifications/",
        "locator": "C2PA Content Credentials specification, provenance assertions, signing and validation; opt-in coverage and trust limitations",
        "teaching_locator": "Perezhohin (2026), Week 6 Generative media, slides 59–60",
        "method": "Directly read authorised Week 6 lecture slides and examined cited primary source. Reviewed keyed answer, explanation and all three alternatives. No Moodle grading inferred.",
        "source_review_status": "independently supported",
        "key_checked": 3,
        "distractor_indices_checked": [
          0,
          1,
          2
        ]
      },
      "course_alignment": {
        "status": "supported",
        "source_type": "original D4B lecture",
        "module": "GEN",
        "week": 6,
        "booklet_locator": "D4B_GenerativeAI_Week6_Generative_Media.pdf, Week 06, Content provenance limits",
        "reviewed_at": "2026-10-13",
        "note": "Original Week 6 lecture slides inspected; canonical Generative AI booklet currently ends at Week 5. Moodle key not checked.",
        "original_moodle_key_checked": false,
        "original_lecture_slides_directly_checked": true
      }
    }
  ]
});
window.D4B_CURRICULUM=Object.freeze({...window.D4B_CURRICULUM,GEN:[...window.D4B_CURRICULUM.GEN,...window.D4B_W6.curriculum.GEN]});
window.D4B_QUESTIONS=Object.freeze([...window.D4B_QUESTIONS,...window.D4B_W6.questions]);
