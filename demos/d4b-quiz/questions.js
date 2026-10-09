/* Original source-labelled practice questions. Private booklet content is not published. */
window.D4B_CURRICULUM=Object.freeze({
  "GEN": [
    "Introduction to Generative AI and Machine Learning",
    "NLP, Embeddings and Large Language Models",
    "Attention and Transformers",
    "Models at Work: Text, Speech and Images",
    "Prompt Engineering"
  ],
  "AIB": [
    "Introduction to AI and its History",
    "Foundational Knowledge for AI",
    "Machine Learning",
    "Data and Datasets",
    "Ethical and Social Implications in AI"
  ],
  "INN": [
    "Fundamentals of Innovation",
    "Innovation Systems, Theoretical Strands and Disruption",
    "Solving Complex Problems and Futures Thinking",
    "Futures Thinking Methods"
  ],
  "DTR": [
    "Digital Transformation: An Overview",
    "Human-centred Digital Transformation and Industry 5.0",
    "AI, Work and Human–AI Teaming",
    "Big Data and Platform Society"
  ]
});
window.D4B_QUESTIONS=Object.freeze([
  {
    "id": "d4b-001",
    "module": "GEN",
    "week": 1,
    "topic": "Generative-model families",
    "stem": "Which model trains a generator in opposition to a discriminator?",
    "choices": [
      "Generative adversarial network",
      "Variational autoencoder",
      "Diffusion model",
      "Autoregressive language model"
    ],
    "correct": 0,
    "explanation": "GAN training pits a generator against a discriminator; a VAE learns a probabilistic latent representation.",
    "source": "01_Generative_AI_Booklet, Week 01, Model families",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01, Model families",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "locator": "Goodfellow et al. (2014), abstract: adversarial generator and discriminator",
      "url": "https://arxiv.org/abs/1406.2661",
      "scope": "GEN W1 · GAN mechanism",
      "method": "Independent technical-primary-source answer and distractor check; this does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-002",
    "module": "GEN",
    "week": 1,
    "topic": "Generative-model families",
    "stem": "A system repeatedly denoises an initially noisy sample to synthesise an image. Which family best fits?",
    "choices": [
      "Variational autoencoder",
      "Diffusion model",
      "Decision tree",
      "K-nearest neighbours"
    ],
    "correct": 1,
    "explanation": "A diffusion model produces samples through successive denoising steps.",
    "source": "01_Generative_AI_Booklet, Week 01, Model families",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01, Model families",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "url": "https://arxiv.org/abs/2006.11239",
      "locator": "Ho, Jain & Abbeel (2020), Denoising Diffusion Probabilistic Models; denoising-based image synthesis",
      "scope": "GEN W1 · diffusion",
      "method": "Independent primary-source answer and distractor check; does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-003",
    "module": "GEN",
    "week": 2,
    "topic": "Text representation",
    "stem": "Why might TF-IDF miss semantic similarity between 'car' and 'automobile'?",
    "choices": [
      "It only works for images",
      "It models tokens by term statistics, not contextual meaning",
      "It requires labels for every word",
      "It converts all words into one scalar"
    ],
    "correct": 1,
    "explanation": "TF-IDF weights lexical terms based on document and corpus frequencies; synonyms need not share a representation.",
    "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://sklearn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfTransformer.html",
      "locator": "scikit-learn TfidfTransformer: lexical token weighting by term frequency and document frequency; no learned synonym equivalence",
      "scope": "TF–IDF is term-statistics representation, not direct semantic-similarity modelling",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-004",
    "module": "GEN",
    "week": 2,
    "topic": "Embeddings",
    "stem": "What is a distinguishing feature of FastText versus basic Word2Vec?",
    "choices": [
      "It uses character subword information",
      "It must use a Transformer decoder",
      "It counts only exact document frequencies",
      "It cannot represent unseen words"
    ],
    "correct": 0,
    "explanation": "FastText incorporates character n-grams, improving representations of rare or unseen words.",
    "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "url": "https://arxiv.org/abs/1607.04606",
      "locator": "Bojanowski et al. (2017), abstract: character n-grams and unseen-word representations",
      "scope": "GEN W2 · FastText",
      "method": "Independent primary-source answer and distractor check; does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-005",
    "module": "GEN",
    "week": 3,
    "topic": "Transformers",
    "stem": "In scaled dot-product attention, what does a query vector primarily do?",
    "choices": [
      "Select how strongly available keys match the current position",
      "Convert tokens back to text directly",
      "Supply the model's correct final label",
      "Store the optimiser's learning rate"
    ],
    "correct": 0,
    "explanation": "Queries are compared with keys to form attention weights that combine values.",
    "source": "01_Generative_AI_Booklet, Week 03, Attention",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03, Attention",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "locator": "Vaswani et al. (2017), §3.2.1: query-key compatibility and value weighting",
      "url": "https://arxiv.org/html/1706.03762v7",
      "scope": "GEN W3 · attention queries",
      "method": "Independent technical-primary-source answer and distractor check; this does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-006",
    "module": "GEN",
    "week": 3,
    "topic": "Transformer architectures",
    "stem": "Which architectural contrast best describes BERT and GPT?",
    "choices": [
      "BERT is encoder-oriented; GPT is decoder-oriented",
      "Both are fixed rule-based systems",
      "BERT predicts only images; GPT predicts only audio",
      "GPT has no attention mechanism"
    ],
    "correct": 0,
    "explanation": "BERT was introduced using a bidirectional Transformer encoder; GPT uses autoregressive Transformer decoding.",
    "source": "01_Generative_AI_Booklet, Week 03, BERT versus GPT",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03, BERT versus GPT",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://aclanthology.org/N19-1423/",
      "locator": "Devlin et al., BERT paper, Abstract and architecture; compare Radford et al., GPT 2018, https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf",
      "scope": "Encoder-oriented BERT versus autoregressive decoder GPT",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-007",
    "module": "GEN",
    "week": 5,
    "topic": "Prompt engineering",
    "stem": "What most directly makes a prompt easier to evaluate reliably?",
    "choices": [
      "Adding more adjectives",
      "Specifying task, constraints and expected output format",
      "Requesting unconditional confidence",
      "Removing all relevant context"
    ],
    "correct": 1,
    "explanation": "Explicit goals, constraints and output structure make success criteria observable.",
    "source": "01_Generative_AI_Booklet, Week 05, Prompt engineering",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 05, Prompt engineering",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 5,
      "booklet_locator": "01_Generative_AI_Booklet, Week 05, Prompt engineering",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-008",
    "module": "AIB",
    "week": 1,
    "topic": "AI systems",
    "stem": "Which relationship is most accurate?",
    "choices": [
      "Deep learning includes all AI",
      "AI includes machine learning; deep learning is a subset of machine learning",
      "Machine learning and rule-based AI are synonyms",
      "Generative AI includes every symbolic expert system"
    ],
    "correct": 1,
    "explanation": "AI is the umbrella field; ML is a subset, and deep learning is a subset of ML.",
    "source": "02_AI_for_Business_Booklet, Week 01, Key distinctions",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 01, Key distinctions",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 1,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 01, Key distinctions",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-009",
    "module": "AIB",
    "week": 2,
    "topic": "Heuristic search",
    "stem": "For A* graph search with nonnegative step costs, what property describes an admissible heuristic?",
    "choices": [
      "It never overestimates remaining optimal cost",
      "It always equals actual distance",
      "It consistently overestimates remaining cost",
      "It is necessarily faster than all other search methods"
    ],
    "correct": 0,
    "explanation": "An admissible heuristic never overestimates the true cost to reach a goal.",
    "source": "02_AI_for_Business_Booklet, Week 02, Heuristic search",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, Heuristic search",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://inst.eecs.berkeley.edu/~cs188/textbook/search/informed.html",
      "locator": "UC Berkeley CS188 §1.4.4: admissible h(n) cannot exceed h*(n), true optimal cost to goal",
      "scope": "Meaning of admissible heuristic (not a universal guarantee for graph-search implementation)",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-010",
    "module": "AIB",
    "week": 2,
    "topic": "Optimisation",
    "stem": "Why can simulated annealing sometimes accept a worse candidate solution?",
    "choices": [
      "To escape local minima during search",
      "To guarantee every step is globally optimal",
      "To avoid evaluating an objective function",
      "To ensure deterministic convergence in one step"
    ],
    "correct": 0,
    "explanation": "Occasional uphill moves can help a search escape local optima; their acceptance becomes less likely as temperature decreases.",
    "source": "02_AI_for_Business_Booklet, Week 02, Search strategies",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, Search strategies",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://inst.eecs.berkeley.edu/~cs188/textbook/csp/local-search.html",
      "locator": "UC Berkeley CS188 §2.5.2: simulated annealing accepts lower-objective moves with probability set by temperature",
      "scope": "Worse candidate can enable escape from local optimum",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-011",
    "module": "AIB",
    "week": 2,
    "topic": "Adversarial search",
    "stem": "What does minimax assume when choosing a move in a deterministic two-player zero-sum game?",
    "choices": [
      "The opponent makes random moves only",
      "The opponent chooses moves to minimise your outcome",
      "The opponent shares your objective",
      "Neither player can compare outcomes"
    ],
    "correct": 1,
    "explanation": "Minimax plans against an adversary selecting the worst outcome for the current player.",
    "source": "02_AI_for_Business_Booklet, Week 02, Minimax",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, Minimax",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://inst.eecs.berkeley.edu/~cs188/textbook/games/minimax.html",
      "locator": "UC Berkeley CS188 §3.2: minimizer assumes an optimal adversary who acts to reduce our utility",
      "scope": "Worst-case opponent choice in deterministic zero-sum games",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-012",
    "module": "AIB",
    "week": 5,
    "topic": "AI ethics",
    "stem": "A training dataset underrepresents one population and produces systematically poorer predictions for it. What is the most immediate issue?",
    "choices": [
      "Dataset bias",
      "Improved external validity",
      "Guaranteed anonymity",
      "Reduced compute energy"
    ],
    "correct": 0,
    "explanation": "Unrepresentative sampling can lead to discriminatory or systematically unequal model performance.",
    "source": "02_AI_for_Business_Booklet, Week 05, Ethical and social implications",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 05, Ethical and social implications",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 5,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 05, Ethical and social implications",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-013",
    "module": "INN",
    "week": 1,
    "topic": "Innovation basics",
    "stem": "A team devises a novel water-monitoring concept but never implements it. Which is the strongest classification?",
    "choices": [
      "Proven innovation",
      "Creativity or invention, not yet realised innovation",
      "Strategic transformation",
      "Commercialisation"
    ],
    "correct": 1,
    "explanation": "Novelty alone does not establish adoption or realised value; the booklet distinguishes creativity, design, implementation and innovation.",
    "source": "03_Innovation_Booklet, Week 01, Key distinctions",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 01, Key distinctions",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 1,
      "booklet_locator": "03_Innovation_Booklet, Week 01, Key distinctions",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-014",
    "module": "INN",
    "week": 1,
    "topic": "Complementary assets",
    "stem": "A startup invents a sensor but lacks distribution and after-sales service. What concept best explains why value capture may fail?",
    "choices": [
      "Complementary assets",
      "The minimax principle",
      "Term frequency",
      "Self-attention"
    ],
    "correct": 0,
    "explanation": "Manufacturing, distribution, service and market access can be necessary to commercialise an invention.",
    "source": "03_Innovation_Booklet, Week 01, Complementary assets",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 01, Complementary assets",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 1,
      "booklet_locator": "03_Innovation_Booklet, Week 01, Complementary assets",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-015",
    "module": "INN",
    "week": 2,
    "topic": "Disruption",
    "stem": "In Christensen's stricter theory, what especially distinguishes disruptive innovation from simply radical innovation?",
    "choices": [
      "Any major technical breakthrough counts",
      "It follows a particular market-entry and improvement trajectory",
      "It requires neural networks",
      "It must be more expensive at launch"
    ],
    "correct": 1,
    "explanation": "Disruption refers to a market and business-model trajectory, often originating in overlooked segments, not merely the scale of technological novelty.",
    "source": "03_Innovation_Booklet, Week 02, Disruption",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 02, Disruption",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://www.christenseninstitute.org/theory/disruptive-innovation/",
      "locator": "Christensen Institute, Definition and Disruptive vs Sustaining Innovations; low-end/new-market foothold and upmarket trajectory",
      "scope": "Market trajectory not radical technological novelty",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-016",
    "module": "INN",
    "week": 4,
    "topic": "Foresight",
    "stem": "Which approach begins with a preferred future and works backwards to identify actions needed to reach it?",
    "choices": [
      "Horizon scanning",
      "Backcasting",
      "Weak-signal detection",
      "Cross-impact analysis"
    ],
    "correct": 1,
    "explanation": "Backcasting derives pathways from a desired future back toward present decisions.",
    "source": "03_Innovation_Booklet, Week 04, Foresight",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 04, Foresight",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 4,
      "booklet_locator": "03_Innovation_Booklet, Week 04, Foresight",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-017",
    "module": "DTR",
    "week": 1,
    "topic": "Digital transformation",
    "stem": "Converting paper laboratory logs into PDF files without changing the workflow is primarily what?",
    "choices": [
      "Digital transformation",
      "Digitisation",
      "Platformisation",
      "Dynamic capability"
    ],
    "correct": 1,
    "explanation": "Digitisation converts analogue information into digital form without necessarily changing organisational processes.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Key distinctions",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Key distinctions",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://www.sciencedirect.com/science/article/pii/S0740624X18304131",
      "locator": "Mergel, Edelmann & Haug (2019), highlights: digitisation and digitalisation differ from holistic transformation; paper-to-PDF is analogue-to-digital conversion",
      "scope": "Digitisation of records without changing workflow",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-018",
    "module": "DTR",
    "week": 1,
    "topic": "Organisational change",
    "stem": "A firm installs advanced digital tools but retains weak leadership and governance. Which Westerman archetype does this resemble?",
    "choices": [
      "Digital Master",
      "Conservative",
      "Fashionista",
      "Beginner"
    ],
    "correct": 2,
    "explanation": "Fashionistas have strong digital investment but relatively weak transformation leadership.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Westerman typology",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Westerman typology",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 1,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 01, Westerman typology",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-019",
    "module": "DTR",
    "week": 1,
    "topic": "Transformation vs technology",
    "stem": "Why does adopting AI software not automatically amount to digital transformation?",
    "choices": [
      "AI is never useful in firms",
      "Transformation also requires changes in capabilities, processes or value creation",
      "Only consumer platforms can transform",
      "Technology eliminates the need for strategy"
    ],
    "correct": 1,
    "explanation": "Digital transformation concerns strategic and organisational change, not simply purchasing digital technology.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Vial process",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Vial process",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://www.sciencedirect.com/science/article/pii/S0740624X18304131",
      "locator": "Mergel et al. (2019), highlights and discussion: organization, culture, relationships and delivery must change beyond technical implementation",
      "scope": "Digital adoption alone is insufficient for organizational transformation",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-020",
    "module": "DTR",
    "week": 1,
    "topic": "Societal dimensions",
    "stem": "Which concern best illustrates a societal assessment beyond firm efficiency?",
    "choices": [
      "Only shorter meeting times",
      "Digital exclusion and unequal access to capabilities",
      "Only increased server throughput",
      "Only application uptime"
    ],
    "correct": 1,
    "explanation": "Societal transformation analysis includes access, skills, inclusion, trust and uneven effects.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Societal lens",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Societal lens",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 1,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 01, Societal lens",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-021",
    "module": "GEN",
    "week": 1,
    "topic": "Learning paradigms",
    "stem": "A rule-based eligibility filter is designed to enforce explicit legal exclusions. Which family is most naturally suited to this function?",
    "choices": [
      "Symbolic reasoning",
      "Unsupervised clustering",
      "Diffusion generation",
      "Sequence-to-sequence translation"
    ],
    "correct": 0,
    "explanation": "Symbolic rules encode explicit constraints and can be audited independently of learned patterns.",
    "source": "01_Generative_AI_Booklet, Week 01, Learning paradigms",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01, Learning paradigms",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 1,
      "booklet_locator": "01_Generative_AI_Booklet, Week 01, Learning paradigms",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-022",
    "module": "GEN",
    "week": 2,
    "topic": "Contextual embeddings",
    "stem": "Why can contextual embeddings represent a word differently in two sentences?",
    "choices": [
      "They assign every word a permanent identifier",
      "They incorporate surrounding context in the representation",
      "They use only document length",
      "They discard the sequence"
    ],
    "correct": 1,
    "explanation": "Context-dependent representations vary with surrounding words, unlike fixed one-vector-per-word schemes.",
    "source": "01_Generative_AI_Booklet, Week 02, Contextual embeddings",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02, Contextual embeddings",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "url": "https://arxiv.org/abs/1802.05365",
      "locator": "Peters et al. (2018), abstract: word uses vary by linguistic context (ELMo)",
      "scope": "GEN W2 · contextual embeddings",
      "method": "Independent primary-source answer and distractor check; does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-023",
    "module": "GEN",
    "week": 3,
    "topic": "Attention",
    "stem": "What is combined using attention weights after query–key comparisons?",
    "choices": [
      "The value vectors",
      "The optimiser learning rate",
      "Training labels only",
      "File metadata"
    ],
    "correct": 0,
    "explanation": "Attention scores weight the value vectors to construct a contextual representation.",
    "source": "01_Generative_AI_Booklet, Week 03, Attention",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03, Attention",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "locator": "Vaswani et al. (2017), §3.2.1: weighted sum of values",
      "url": "https://arxiv.org/html/1706.03762v7",
      "scope": "GEN W3 · attention values",
      "method": "Independent technical-primary-source answer and distractor check; this does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-024",
    "module": "GEN",
    "week": 4,
    "topic": "Model selection",
    "stem": "Which architecture is usually the most natural starting point for text classification or semantic retrieval?",
    "choices": [
      "Encoder-only Transformer",
      "Decoder-only autoregressive model",
      "Adversarial generator",
      "Diffusion image model"
    ],
    "correct": 0,
    "explanation": "Encoder representations are well suited to discriminative labelling and embedding-based retrieval.",
    "source": "01_Generative_AI_Booklet, Week 04, Model selection",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04, Model selection",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 4,
      "booklet_locator": "01_Generative_AI_Booklet, Week 04, Model selection",
      "reviewed_at": "2026-10-09",
      "note": "Generative AI Week 4 describes encoder models as a natural task fit for classification and retrieval, not the only possible architecture.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-025",
    "module": "GEN",
    "week": 4,
    "topic": "Model cards",
    "stem": "A model scores well but its licence and training-data provenance are unclear. What is the most defensible next action?",
    "choices": [
      "Deploy immediately because accuracy is high",
      "Review licence, provenance and deployment limits before use",
      "Assume the hub has guaranteed compliance",
      "Treat parameter count as proof of safety"
    ],
    "correct": 1,
    "explanation": "Model suitability depends on rights, provenance and operational constraints as well as accuracy.",
    "source": "01_Generative_AI_Booklet, Week 04, Model cards",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04, Model cards",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 4,
      "booklet_locator": "01_Generative_AI_Booklet, Week 04, Model cards",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-026",
    "module": "GEN",
    "week": 4,
    "topic": "Inference pipelines",
    "stem": "In a text-classification pipeline, what normally follows raw model logits?",
    "choices": [
      "Post-processing to labels or probabilities",
      "Rewriting the model architecture",
      "Deleting token identifiers from training data",
      "Sampling a new training corpus"
    ],
    "correct": 0,
    "explanation": "Task-specific post-processing maps model scores into interpretable outputs.",
    "source": "01_Generative_AI_Booklet, Week 04, Inference pipelines",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04, Inference pipelines",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://github.com/huggingface/transformers/blob/main/src/transformers/pipelines/text_classification.py",
      "locator": "Hugging Face Transformers TextClassificationPipeline, postprocess: logits -> sigmoid/softmax -> label/score",
      "scope": "Logit post-processing for text classification",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-027",
    "module": "GEN",
    "week": 4,
    "topic": "Decoding",
    "stem": "What happens when generation temperature is increased, other settings held constant?",
    "choices": [
      "Probability mass generally becomes less concentrated",
      "The model gains factual knowledge",
      "The tokeniser learns new vocabulary",
      "Output becomes necessarily correct"
    ],
    "correct": 0,
    "explanation": "Higher temperature flattens the next-token distribution, increasing the relative chance of lower-probability tokens.",
    "source": "01_Generative_AI_Booklet, Week 04, Decoding",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04, Decoding",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://huggingface.co/docs/transformers/v4.55.4/en/main_classes/text_generation",
      "locator": "Hugging Face GenerationConfig: temperature modulates next-token logits/probabilities; increasing positive temperature flattens a nonuniform softmax distribution",
      "scope": "Higher positive sampling temperature makes the model probability distribution less concentrated, holding other settings fixed",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-028",
    "module": "GEN",
    "week": 5,
    "topic": "Evaluation",
    "stem": "A prompt is repeatedly changed after inspecting the same examples. What evaluation risk arises?",
    "choices": [
      "Selection overfits the development examples",
      "All hallucinations become impossible",
      "Tokenisation becomes unnecessary",
      "The licence automatically changes"
    ],
    "correct": 0,
    "explanation": "Optimising against a narrow set of examples may not transfer to unseen inputs.",
    "source": "01_Generative_AI_Booklet, Week 05, Evaluation",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 05, Evaluation",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 5,
      "booklet_locator": "01_Generative_AI_Booklet, Week 05, Evaluation",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-029",
    "module": "AIB",
    "week": 1,
    "topic": "Compute",
    "stem": "Why are GPUs widely used in deep learning?",
    "choices": [
      "They support highly parallel tensor computation",
      "They enforce legal data consent",
      "They eliminate model bias",
      "They replace the need for training data"
    ],
    "correct": 0,
    "explanation": "Many neural-network operations benefit from parallel matrix and tensor computation.",
    "source": "02_AI_for_Business_Booklet, Week 01, Compute",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 01, Compute",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 1,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 01, Compute",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-030",
    "module": "AIB",
    "week": 2,
    "topic": "A-star search",
    "stem": "Which score does A* normally use to prioritise a state?",
    "choices": [
      "Estimated remaining cost only",
      "Path cost so far plus estimated remaining cost",
      "Number of moves only",
      "Uniform random priority"
    ],
    "correct": 1,
    "explanation": "A* evaluates f(n)=g(n)+h(n), combining accrued path cost with estimated cost-to-go.",
    "source": "02_AI_for_Business_Booklet, Week 02, A-star search",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, A-star search",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://inst.eecs.berkeley.edu/~cs188/textbook/search/informed.html",
      "locator": "UC Berkeley CS188 §1.4.4: f(n)=g(n)+h(n); g is path cost to node and h is estimated remaining cost",
      "scope": "A* prioritization score",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-031",
    "module": "AIB",
    "week": 3,
    "topic": "Machine-learning tasks",
    "stem": "Predicting next month's river discharge as a numerical value is primarily an example of what?",
    "choices": [
      "Regression",
      "Classification",
      "Clustering",
      "Association-rule discovery"
    ],
    "correct": 0,
    "explanation": "Regression predicts a quantitative target rather than a discrete class.",
    "source": "02_AI_for_Business_Booklet, Week 03, Machine-learning tasks",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03, Machine-learning tasks",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://scikit-learn.org/stable/modules/linear_model.html",
      "locator": "scikit-learn linear models §1.1 regression: numeric target y is predicted using features",
      "scope": "Forecast numeric river discharge is regression rather than discrete classification",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-032",
    "module": "AIB",
    "week": 3,
    "topic": "Validation",
    "stem": "Why should the held-out test set not be used repeatedly to tune hyperparameters?",
    "choices": [
      "It would become part of model selection and bias performance estimates",
      "It contains no information",
      "Hyperparameters only apply to unsupervised methods",
      "Tests are unnecessary when training accuracy is high"
    ],
    "correct": 0,
    "explanation": "Repeated optimisation against test results undermines its independence as a final generalisation estimate.",
    "source": "02_AI_for_Business_Booklet, Week 03, Validation",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03, Validation",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "locator": "scikit-learn Common Pitfalls, §12.2: separation of final test data from model selection",
      "url": "https://scikit-learn.org/stable/common_pitfalls.html#data-leakage",
      "scope": "AIB W3 · independent testing",
      "method": "Independent technical-primary-source answer and distractor check; this does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-033",
    "module": "AIB",
    "week": 3,
    "topic": "Data leakage",
    "stem": "A scaler is fitted on all samples before the training/test split. What is the issue?",
    "choices": [
      "Information from the test distribution leaks into training preprocessing",
      "The scaler necessarily learns the target label",
      "Feature scaling cannot be used with supervised models",
      "All tests must use raw units"
    ],
    "correct": 0,
    "explanation": "Preprocessing that learns dataset statistics should be fitted on training data to avoid leakage.",
    "source": "02_AI_for_Business_Booklet, Week 03, Data leakage",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03, Data leakage",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "locator": "scikit-learn Common Pitfalls, §12.2: split data before fitting StandardScaler",
      "url": "https://scikit-learn.org/stable/common_pitfalls.html#data-leakage",
      "scope": "AIB W3 · data leakage",
      "method": "Independent technical-primary-source answer and distractor check; this does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-034",
    "module": "AIB",
    "week": 4,
    "topic": "Database design",
    "stem": "What is the primary purpose of a foreign key in a relational database?",
    "choices": [
      "Link records across related tables",
      "Generate synthetic labels",
      "Make every value unique in its own table",
      "Standardise a feature distribution"
    ],
    "correct": 0,
    "explanation": "A foreign key references a key in another table to express and enforce a relationship.",
    "source": "02_AI_for_Business_Booklet, Week 04, Database design",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Database design",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://www.postgresql.org/docs/current/ddl-constraints.html",
      "locator": "PostgreSQL §5.5.5 Foreign Keys: a column/group references values in a related table and maintains referential integrity",
      "scope": "Foreign key expresses/enforces relationships between records across tables",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-035",
    "module": "AIB",
    "week": 4,
    "topic": "Database modelling",
    "stem": "At which stage is an Entity–Relationship model most directly used?",
    "choices": [
      "Conceptual database design",
      "Physical server cabling",
      "Stochastic optimisation",
      "Final model scoring"
    ],
    "correct": 0,
    "explanation": "Entity–Relationship modelling captures entities and their relationships at the conceptual design stage.",
    "source": "02_AI_for_Business_Booklet, Week 04, Database modelling",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Database modelling",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://www.ibm.com/think/topics/entity-relationship-diagram",
      "locator": "IBM Entity Relationship Diagram: ERD is high-level conceptual database model in three-schema framework",
      "scope": "ER diagrams used primarily at conceptual database design stage",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-036",
    "module": "AIB",
    "week": 4,
    "topic": "Data quality",
    "stem": "Two departments record the same customer with conflicting addresses. Which property is principally affected?",
    "choices": [
      "Consistency",
      "Dimensionality",
      "Sampling rate",
      "Ordinality"
    ],
    "correct": 0,
    "explanation": "Contradictory representations of the same entity indicate a consistency problem.",
    "source": "02_AI_for_Business_Booklet, Week 04, Data quality",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Data quality",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 4,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 04, Data quality",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-037",
    "module": "AIB",
    "week": 4,
    "topic": "Imbalanced classes",
    "stem": "A fraud classifier predicts 'not fraud' for every case in a dataset with 99% legitimate transactions. What is the key warning?",
    "choices": [
      "Overall accuracy alone hides failure on the minority class",
      "The system has perfect recall for fraud",
      "The dataset must be normally distributed",
      "The labels are automatically unbiased"
    ],
    "correct": 0,
    "explanation": "Accuracy can be deceptively high while minority-class recall is zero.",
    "source": "02_AI_for_Business_Booklet, Week 04, Imbalanced classes",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Imbalanced classes",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://scikit-learn.org/stable/modules/model_evaluation.html",
      "locator": "scikit-learn model evaluation, balanced accuracy and imbalanced classes; a constant nonfraud prediction has zero positive recall",
      "scope": "99% accuracy conceals fraud minority-class failure",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-038",
    "module": "AIB",
    "week": 5,
    "topic": "Trustworthy AI",
    "stem": "Which distinction between AI ethics and the EU AI Act is correct?",
    "choices": [
      "Ethical governance may demand more than minimum legal compliance",
      "The AI Act covers every ethical issue exhaustively",
      "Ethical principles are identical to criminal law",
      "Regulation makes human oversight redundant"
    ],
    "correct": 0,
    "explanation": "The AI Act establishes binding obligations, while responsible practice can impose additional ethical safeguards.",
    "source": "02_AI_for_Business_Booklet, Week 05, Trustworthy AI",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 05, Trustworthy AI",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 5,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 05, Trustworthy AI",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-039",
    "module": "INN",
    "week": 1,
    "topic": "Creative destruction",
    "stem": "Which idea is most associated with Schumpeter's creative destruction?",
    "choices": [
      "Innovation creates new structures while displacing established ones",
      "Firms never lose market share after inventions",
      "All innovations are incremental",
      "Every invention has an equal probability of adoption"
    ],
    "correct": 0,
    "explanation": "Creative destruction connects new combinations with displacement of existing economic arrangements.",
    "source": "03_Innovation_Booklet, Week 01, Creative destruction",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 01, Creative destruction",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 1,
      "booklet_locator": "03_Innovation_Booklet, Week 01, Creative destruction",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-040",
    "module": "INN",
    "week": 2,
    "topic": "Learning modes",
    "stem": "A manufacturer improves equipment through repeated hands-on interaction with users. Which learning mode is most directly illustrated?",
    "choices": [
      "Doing, Using and Interacting (DUI)",
      "Science, Technology and Innovation (STI) only",
      "Random sampling",
      "Automatic text generation"
    ],
    "correct": 0,
    "explanation": "DUI learning highlights practical, experiential and interactive knowledge flows.",
    "source": "03_Innovation_Booklet, Week 02, Learning modes",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 02, Learning modes",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 2,
      "booklet_locator": "03_Innovation_Booklet, Week 02, Learning modes",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-041",
    "module": "INN",
    "week": 3,
    "topic": "Complexity",
    "stem": "Why might a complex social–environmental problem resist a fixed optimisation plan?",
    "choices": [
      "Feedback and adaptation can alter the system as interventions occur",
      "The problem has no participants",
      "Every component is independent",
      "Its outputs are always linear"
    ],
    "correct": 0,
    "explanation": "Complex systems have interacting parts, feedbacks and adaptive responses that change outcomes.",
    "source": "03_Innovation_Booklet, Week 03, Complexity",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 03, Complexity",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 3,
      "booklet_locator": "03_Innovation_Booklet, Week 03, Complexity",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-042",
    "module": "INN",
    "week": 3,
    "topic": "Foresight",
    "stem": "Which statement best describes strategic foresight?",
    "choices": [
      "Exploring plausible alternatives to improve today's decisions",
      "Predicting one certain future",
      "Replacing all forecasts with intuition",
      "Selecting only the most probable outcome"
    ],
    "correct": 0,
    "explanation": "Foresight investigates multiple plausible futures rather than claiming certainty about one trajectory.",
    "source": "03_Innovation_Booklet, Week 03, Foresight",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 03, Foresight",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 3,
      "booklet_locator": "03_Innovation_Booklet, Week 03, Foresight",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-043",
    "module": "INN",
    "week": 3,
    "topic": "Futures cone",
    "stem": "A future described as preferable is primarily judged by which dimension?",
    "choices": [
      "Desirability from a specified perspective",
      "Measured occurrence frequency",
      "Statistical confidence interval",
      "Historic average trend"
    ],
    "correct": 0,
    "explanation": "Preferability is normative and depends on whose values and interests are considered.",
    "source": "03_Innovation_Booklet, Week 03, Futures cone",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 03, Futures cone",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 3,
      "booklet_locator": "03_Innovation_Booklet, Week 03, Futures cone",
      "reviewed_at": "2026-10-09",
      "note": "Innovation Week 3 treats preferable futures as normative and stakeholder-dependent, not probabilistically certain.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-044",
    "module": "INN",
    "week": 4,
    "topic": "Scanning",
    "stem": "A faint early sign of a potentially important change is best termed what?",
    "choices": [
      "Weak signal",
      "Megatrend",
      "Roadmap milestone",
      "Market saturation"
    ],
    "correct": 0,
    "explanation": "Weak signals are early and ambiguous indications, rather than broad persistent trends.",
    "source": "03_Innovation_Booklet, Week 04, Scanning",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 04, Scanning",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 4,
      "booklet_locator": "03_Innovation_Booklet, Week 04, Scanning",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-045",
    "module": "DTR",
    "week": 1,
    "topic": "Digital stages",
    "stem": "Electronic approvals replace paper routing but the business model stays unchanged. Which change is most directly illustrated?",
    "choices": [
      "Digitalisation",
      "Digitisation alone",
      "Full organisational transformation",
      "Platform monopolisation"
    ],
    "correct": 0,
    "explanation": "Digitalisation changes or streamlines processes using digital technologies; transformation entails deeper organisational or value-creation change.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Digital stages",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Digital stages",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-09",
      "url": "https://www.sciencedirect.com/science/article/pii/S0740624X18304131",
      "locator": "Mergel et al. (2019) distinguishes digitalisation of processes from organization-wide digital transformation; replacing paper approvals is process digitisation/digitalisation",
      "scope": "Digitalised approval workflow is not necessarily strategic transformation",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-046",
    "module": "DTR",
    "week": 2,
    "topic": "Industry 5.0",
    "stem": "Which set best captures the normative emphasis of Industry 5.0?",
    "choices": [
      "Human-centricity, sustainability and resilience",
      "Only maximum automation and throughput",
      "Replacement of every worker",
      "Exclusive focus on digital advertising"
    ],
    "correct": 0,
    "explanation": "Industry 5.0 frames innovation around worker well-being, environmental sustainability and resilience.",
    "source": "04_Digital_Transformation_Booklet, Week 02, Industry 5.0",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 02, Industry 5.0",
      "originalMaterialChecked": true,
      "reviewed_at": "2026-10-08",
      "url": "https://research-and-innovation.ec.europa.eu/research-area/industrial-research-and-innovation/industry-50_en",
      "locator": "European Commission, Industry 5.0, 'What is Industry 5.0?' three core priorities",
      "scope": "DTR W2 · Industry 5.0",
      "method": "Independent primary-source answer and distractor check; does not authenticate Moodle grading."
    }
  },
  {
    "id": "d4b-047",
    "module": "DTR",
    "week": 2,
    "topic": "Digital maturity",
    "stem": "Why does a high Digital Intensity Index score not prove full transformation maturity?",
    "choices": [
      "It counts technology adoption rather than evaluating strategy and outcomes",
      "It measures only carbon emissions",
      "It excludes internet connectivity",
      "It guarantees responsible governance"
    ],
    "correct": 0,
    "explanation": "DII tallies digital technology use, not whether the organisation changes strategy, value creation or governance effectively.",
    "source": "04_Digital_Transformation_Booklet, Week 02, Digital maturity",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 02, Digital maturity",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 2,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 02, Digital maturity",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-048",
    "module": "DTR",
    "week": 2,
    "topic": "Human–robot collaboration",
    "stem": "A collaborative robot is installed beside workers. Which safety claim is most defensible?",
    "choices": [
      "Safety depends on application-specific risk assessment and safeguards",
      "The cobot label guarantees safety in every task",
      "Shared spaces eliminate physical hazards",
      "Operator training makes protective design unnecessary"
    ],
    "correct": 0,
    "explanation": "Collaborative operation still requires assessment and controls appropriate to the actual task.",
    "source": "04_Digital_Transformation_Booklet, Week 02, Human–robot collaboration",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 02, Human–robot collaboration",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 2,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 02, Human–robot collaboration",
      "reviewed_at": "2026-10-09",
      "note": "Digital Transformation Week 2 qualifies collaborative robotics safety as application-specific; a cobot label does not guarantee safety.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-049",
    "module": "DTR",
    "week": 3,
    "topic": "Technological frontier",
    "stem": "An AI system performs well on one complex task but poorly on a superficially similar one. What concept explains this?",
    "choices": [
      "Jagged technological frontier",
      "Uniform capability scaling",
      "Perfect transfer learning",
      "Deterministic productivity"
    ],
    "correct": 0,
    "explanation": "AI competence can vary unexpectedly between neighbouring tasks; performance must be tested at task level.",
    "source": "04_Digital_Transformation_Booklet, Week 03, Technological frontier",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 03, Technological frontier",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 3,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 03, Technological frontier",
      "reviewed_at": "2026-10-09",
      "note": "Digital Transformation Week 3 uses the jagged-frontier concept; task-level testing is necessary, including for tasks that look similar.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-050",
    "module": "DTR",
    "week": 3,
    "topic": "Technology trade-offs",
    "stem": "An AI tool speeds report drafting but reduces opportunities for junior staff to practise analysis. Which interpretation is strongest?",
    "choices": [
      "Technological gains may come with unevenly distributed costs",
      "Efficiency automatically creates net benefits for everyone",
      "The workforce has no reason to evaluate skill loss",
      "The trade-off disappears if the tool is popular"
    ],
    "correct": 0,
    "explanation": "Socio-technical assessment must consider both benefits and displaced skills, autonomy and responsibilities.",
    "source": "04_Digital_Transformation_Booklet, Week 03, Technology trade-offs",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 03, Technology trade-offs",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 3,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 03, Technology trade-offs",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-051",
    "module": "DTR",
    "week": 3,
    "topic": "Human–AI teaming",
    "stem": "Why does a conversational system's fluent response not establish its reliability?",
    "choices": [
      "Fluency and evidence-grounded correctness are distinct",
      "Humanlike text certifies a data source",
      "Confidence guarantees calibration",
      "Long answers cannot contain errors"
    ],
    "correct": 0,
    "explanation": "A model can generate persuasive language while still making unsupported claims.",
    "source": "04_Digital_Transformation_Booklet, Week 03, Human–AI teaming",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 03, Human–AI teaming",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 3,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 03, Human–AI teaming",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-052",
    "module": "DTR",
    "week": 4,
    "topic": "Platforms",
    "stem": "What is platformization?",
    "choices": [
      "The increasing embedding of digital platforms as infrastructures of everyday activity",
      "Converting paper records to PDFs",
      "Physically connecting desktop printers",
      "Replacing all software with spreadsheets"
    ],
    "correct": 0,
    "explanation": "Platformization describes platforms becoming integral socio-technical infrastructures.",
    "source": "04_Digital_Transformation_Booklet, Week 04, Platforms",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 04, Platforms",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 4,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 04, Platforms",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-053",
    "module": "DTR",
    "week": 4,
    "topic": "Algorithmic selection",
    "stem": "A ranking algorithm affects which local services users discover. What mechanism is illustrated?",
    "choices": [
      "Selection or visibility power",
      "Pure data storage",
      "Analogue archiving",
      "A physical network outage"
    ],
    "correct": 0,
    "explanation": "Ranking and recommendation systems shape visibility and thus influence behaviour and economic outcomes.",
    "source": "04_Digital_Transformation_Booklet, Week 04, Algorithmic selection",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 04, Algorithmic selection",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 4,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 04, Algorithmic selection",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-054",
    "module": "DTR",
    "week": 4,
    "topic": "Datafication",
    "stem": "What is datafication in a platform society?",
    "choices": [
      "Representing activities and relationships as measurable data",
      "Deleting all data after use",
      "Encrypting a hard drive",
      "Separating digital work from organisational processes"
    ],
    "correct": 0,
    "explanation": "Datafication turns aspects of human activity into quantified, trackable data.",
    "source": "04_Digital_Transformation_Booklet, Week 04, Datafication",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 04, Datafication",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 4,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 04, Datafication",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-055",
    "module": "DTR",
    "week": 4,
    "topic": "Interoperability",
    "stem": "Which design choice best reduces unnecessary vendor lock-in?",
    "choices": [
      "Portable input/output formats and documented dependencies",
      "Proprietary exports without documentation",
      "A single inaccessible cloud database",
      "Removing data lineage records"
    ],
    "correct": 0,
    "explanation": "Interoperable formats and clear dependency documentation support portability and contestability.",
    "source": "04_Digital_Transformation_Booklet, Week 04, Interoperability",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 04, Interoperability",
      "originalMaterialChecked": false
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 4,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 04, Interoperability",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-056",
    "module": "GEN",
    "week": 1,
    "topic": "Variational autoencoders",
    "stem": "What makes a variational autoencoder's bottleneck distinct from a conventional deterministic autoencoder?",
    "choices": [
      "It learns a probability distribution over latent representations",
      "It requires an opponent discriminator",
      "It encodes only labels, not inputs",
      "It performs no decoding"
    ],
    "correct": 0,
    "explanation": "VAEs learn a probabilistic latent space and sample from it when generating outputs.",
    "source": "01_Generative_AI_Booklet, Week 01, Model families",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01 / Model families",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://arxiv.org/abs/1312.6114",
      "locator": "Kingma and Welling, Auto-Encoding Variational Bayes, Abstract and approximate posterior/latent variables",
      "scope": "Probabilistic latent encoding versus deterministic autoencoder",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-057",
    "module": "GEN",
    "week": 1,
    "topic": "Discriminative vs generative models",
    "stem": "Which system is most clearly discriminative rather than generative?",
    "choices": [
      "A classifier labelling water samples as pass or fail",
      "A diffusion system synthesising images",
      "A language model drafting text",
      "A model synthesising new audio"
    ],
    "correct": 0,
    "explanation": "Discriminative models learn decision boundaries or conditional labels, whereas generative approaches model or produce data.",
    "source": "01_Generative_AI_Booklet, Week 01, Generative versus discriminative AI",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01 / Generative versus discriminative AI",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 1,
      "booklet_locator": "01_Generative_AI_Booklet, Week 01, Generative versus discriminative AI",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-058",
    "module": "GEN",
    "week": 2,
    "topic": "Contextual language modelling",
    "stem": "How does ELMo differ from a fixed Word2Vec embedding for an ambiguous word?",
    "choices": [
      "ELMo can create context-dependent representations",
      "ELMo is restricted to document frequency counts",
      "Word2Vec changes its vector for every sentence",
      "ELMo uses no sequence context"
    ],
    "correct": 0,
    "explanation": "ELMo's representations reflect surrounding text; classic Word2Vec produces a fixed vector for a vocabulary item.",
    "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02 / Embeddings",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://aclanthology.org/N18-1202/",
      "locator": "Peters et al. (2018), ACL Anthology abstract: ELMo representations depend on context and polysemy from bidirectional LM",
      "scope": "ELMo context-dependence versus fixed Word2Vec vocabulary vector",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-059",
    "module": "GEN",
    "week": 2,
    "topic": "Smoothing in language models",
    "stem": "Why is smoothing used when estimating probabilities for infrequent or unseen token sequences?",
    "choices": [
      "To avoid assigning every unobserved sequence a zero probability",
      "To reduce vocabulary to one token",
      "To remove the need for a corpus",
      "To certify generated claims as true"
    ],
    "correct": 0,
    "explanation": "Smoothing reallocates some probability mass, allowing unseen n-grams to receive nonzero estimates.",
    "source": "01_Generative_AI_Booklet, Week 02, Language-model smoothing",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02 / Language-model smoothing",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 2,
      "booklet_locator": "01_Generative_AI_Booklet, Week 02, Language-model smoothing",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-060",
    "module": "GEN",
    "week": 3,
    "topic": "Multi-head attention",
    "stem": "What benefit is usually sought from several attention heads?",
    "choices": [
      "Learning different representation relationships in parallel",
      "Guaranteeing that all heads agree",
      "Removing positional information completely",
      "Eliminating computational cost"
    ],
    "correct": 0,
    "explanation": "Multiple heads can attend to different relationships or representational subspaces.",
    "source": "01_Generative_AI_Booklet, Week 03, Multi-head attention",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03 / Multi-head attention",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://arxiv.org/abs/1706.03762",
      "locator": "Vaswani et al., Attention Is All You Need, §3.2.2 Multi-Head Attention",
      "scope": "Multiple representation subspaces and attention relationships",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-061",
    "module": "GEN",
    "week": 3,
    "topic": "Causal masking",
    "stem": "Why does an autoregressive decoder mask later tokens during training?",
    "choices": [
      "To prevent information from future positions leaking into next-token predictions",
      "To hide all input labels from the model",
      "To prevent the network learning attention weights",
      "To convert decoding into clustering"
    ],
    "correct": 0,
    "explanation": "A causal mask limits each position's attention to its available past and current context.",
    "source": "01_Generative_AI_Booklet, Week 03, Decoder attention",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03 / Decoder attention",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://arxiv.org/abs/1706.03762",
      "locator": "Vaswani et al., Attention Is All You Need, §3.1 Decoder, masking future positions",
      "scope": "Causal masking prevents attending to subsequent positions",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-062",
    "module": "GEN",
    "week": 4,
    "topic": "Tokenisers",
    "stem": "A Hugging Face classifier accepts raw text in a pipeline. What converts it to the numerical inputs expected by the model?",
    "choices": [
      "Tokenizer",
      "Discriminator",
      "Roadmap",
      "Database join"
    ],
    "correct": 0,
    "explanation": "A tokenizer converts input text into token identifiers consumed by the model.",
    "source": "01_Generative_AI_Booklet, Week 04, Hugging Face pipeline",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04 / Hugging Face pipeline",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://github.com/huggingface/transformers/blob/main/docs/source/en/tasks/sequence_classification.md",
      "locator": "Hugging Face Transformers sequence-classification tutorial, inference: AutoTokenizer(text) -> model logits",
      "scope": "Tokenizers turn text into token identifiers",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-063",
    "module": "GEN",
    "week": 4,
    "topic": "Model validation",
    "stem": "A small pretrained model and a larger model both pass the required validation on real task data. What is the lecture's prudent default?",
    "choices": [
      "Prefer the smallest model that meets the requirements",
      "Always choose the largest model regardless of cost",
      "Ignore licensing if accuracy is equal",
      "Deploy both without operational testing"
    ],
    "correct": 0,
    "explanation": "Model selection must account for task fit, resource cost, provenance and licence; size alone is not quality.",
    "source": "01_Generative_AI_Booklet, Week 04, Model selection and validation",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04 / Model selection and validation",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "qualified",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 4,
      "booklet_locator": "01_Generative_AI_Booklet, Week 04, Model selection and validation",
      "reviewed_at": "2026-10-09",
      "note": "This is the Generative AI Week 4 lecturer's conditional rule of thumb: choose the smallest model that passes the relevant test on the intended data. It is not a universal requirement to prefer small models.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-064",
    "module": "GEN",
    "week": 5,
    "topic": "Few-shot prompts",
    "stem": "What makes a few-shot prompt different from a zero-shot task instruction?",
    "choices": [
      "It includes examples illustrating the required input–output behaviour",
      "It must retrain the model parameters",
      "It requires image input",
      "It prohibits constraints and formatting"
    ],
    "correct": 0,
    "explanation": "Few-shot prompting includes examples within the prompt; zero-shot prompting asks without demonstrated examples.",
    "source": "01_Generative_AI_Booklet, Week 05, Prompting methods",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 05 / Prompting methods",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://huggingface.co/docs/transformers/tasks/prompting",
      "locator": "Hugging Face Transformers Prompt Engineering, few-shot prompting: task examples included as demonstrations",
      "scope": "Few-shot includes examples rather than parameter retraining",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-065",
    "module": "GEN",
    "week": 5,
    "topic": "Prompt evaluation",
    "stem": "Which is the stronger way to judge whether a prompt revision generalises?",
    "choices": [
      "Test it against a held-out set of representative unseen cases",
      "Judge only the example used while writing it",
      "Trust the model's self-reported confidence",
      "Increase length until it looks sophisticated"
    ],
    "correct": 0,
    "explanation": "A held-out test set guards against overfitting a prompt to the examples used during development.",
    "source": "01_Generative_AI_Booklet, Week 05, Prompt evaluation",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 05 / Prompt evaluation",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "GEN",
      "week": 5,
      "booklet_locator": "01_Generative_AI_Booklet, Week 05, Prompt evaluation",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-066",
    "module": "AIB",
    "week": 1,
    "topic": "Intelligent agents",
    "stem": "In the classic intelligent-agent model, what completes the core loop after the agent takes an action?",
    "choices": [
      "The environment changes and provides new observations",
      "A developer deletes the state space",
      "Every next action is predetermined",
      "The agent becomes a database"
    ],
    "correct": 0,
    "explanation": "An agent perceives the environment, selects actions and receives consequences through subsequent observations.",
    "source": "02_AI_for_Business_Booklet, Week 01, Intelligent agents",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 01 / Intelligent agents",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 1,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 01, Intelligent agents",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-067",
    "module": "AIB",
    "week": 1,
    "topic": "Rule-based vs learned systems",
    "stem": "Which business requirement is best handled with an explicit deterministic rule rather than a trained classifier?",
    "choices": [
      "Rejecting payments that exceed a legally fixed limit",
      "Recognising damage from diverse image patterns",
      "Detecting novel speech accents",
      "Grouping unfamiliar customer behaviour"
    ],
    "correct": 0,
    "explanation": "Known binding thresholds are generally easier to implement and audit using explicit rules.",
    "source": "02_AI_for_Business_Booklet, Week 01, Rules versus learning",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 01 / Rules versus learning",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 1,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 01, Rules versus learning",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-068",
    "module": "AIB",
    "week": 2,
    "topic": "Breadth-first search",
    "stem": "For an unweighted graph, which frontier structure is characteristic of breadth-first search?",
    "choices": [
      "First-in first-out queue",
      "Last-in first-out stack only",
      "Priority by learned reward",
      "Random sampling of final goal nodes"
    ],
    "correct": 0,
    "explanation": "Breadth-first search expands nodes in discovery order using a queue.",
    "source": "02_AI_for_Business_Booklet, Week 02, Uninformed search",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02 / Uninformed search",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://inst.eecs.berkeley.edu/~cs188/textbook/search/uninformed.html",
      "locator": "UC Berkeley CS188 §1.3.2: BFS frontier uses a first-in first-out (FIFO) queue",
      "scope": "Breadth-first search frontier ordering",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-069",
    "module": "AIB",
    "week": 2,
    "topic": "Genetic algorithms",
    "stem": "Which combination is characteristic of a genetic algorithm?",
    "choices": [
      "Population, selection, crossover and mutation",
      "Only one fixed solution and no variation",
      "Guaranteed globally optimal path on the first step",
      "Minimax tree pruning without candidates"
    ],
    "correct": 0,
    "explanation": "Evolutionary search iteratively transforms populations using selection and variation.",
    "source": "02_AI_for_Business_Booklet, Week 02, Genetic algorithms",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02 / Genetic algorithms",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://inst.eecs.berkeley.edu/~cs188/textbook/csp/local-search.html",
      "locator": "UC Berkeley CS188 §2.5.3: population, fitness-based parent selection, crossover, random mutation",
      "scope": "Evolutionary genetic algorithm operations",
      "method": "Independently checked question stem, correct key, three distractors and rationale against cited academic/technical original source; not an assertion of Moodle grading."
    }
  },
  {
    "id": "d4b-070",
    "module": "AIB",
    "week": 3,
    "topic": "Evaluation metrics",
    "stem": "Why can precision and recall be more informative than accuracy for a rare positive class?",
    "choices": [
      "They expose different kinds of positive-class error",
      "They do not require true labels",
      "They make class imbalance impossible",
      "They always have the same value"
    ],
    "correct": 0,
    "explanation": "Precision and recall separate false-positive burden from missed positives, whereas overall accuracy can conceal poor minority-class behaviour.",
    "source": "02_AI_for_Business_Booklet, Week 03, Classification evaluation",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03 / Classification evaluation",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://scikit-learn.org/stable/auto_examples/model_selection/plot_precision_recall.html",
      "locator": "scikit-learn Precision-Recall example: TP/(TP+FP), TP/(TP+FN), especially imbalanced classes",
      "scope": "Precision and recall measure distinct minority-positive mistakes",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-071",
    "module": "AIB",
    "week": 3,
    "topic": "Early stopping",
    "stem": "Why would a training procedure stop while training loss is still decreasing?",
    "choices": [
      "Validation performance has stopped improving and generalisation may deteriorate",
      "The model no longer contains weights",
      "Training and test sets have become identical by law",
      "A lower training loss always proves overfitting"
    ],
    "correct": 0,
    "explanation": "Early stopping uses validation trends to avoid excessive fitting to training data.",
    "source": "02_AI_for_Business_Booklet, Week 03, Overfitting and validation",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03 / Overfitting and validation",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://scikit-learn.org/stable/modules/generated/sklearn.neural_network.MLPClassifier.html",
      "locator": "scikit-learn MLPClassifier parameter early_stopping; validation-score based stopping even if training loss improves",
      "scope": "Early stopping based on independent validation behaviour",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-072",
    "module": "AIB",
    "week": 4,
    "topic": "Feature preprocessing",
    "stem": "Which sequence most directly prevents information leakage when scaling training data?",
    "choices": [
      "Split first, fit scaler on training records, then transform held-out records",
      "Fit scaler on all records and then split",
      "Tune models repeatedly on the final test set",
      "Drop target labels after evaluation"
    ],
    "correct": 0,
    "explanation": "Parameters for preprocessing must be learned from the training partition only.",
    "source": "02_AI_for_Business_Booklet, Week 04, Preprocessing and leakage",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04 / Preprocessing and leakage",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://scikit-learn.org/stable/common_pitfalls.html#data-leakage",
      "locator": "scikit-learn Common Pitfalls: split training/test before fitting transforms; apply train-fitted scaler to test",
      "scope": "Avoid data leakage during scaling",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-073",
    "module": "AIB",
    "week": 4,
    "topic": "Data quality dimensions",
    "stem": "A monitoring dataset contains duplicate records that inflate counts. What is the most direct action?",
    "choices": [
      "Diagnose and resolve duplication with documented rules",
      "Increase the learning rate until duplicates disappear",
      "Treat duplicates as proof of high completeness",
      "Discard the data dictionary"
    ],
    "correct": 0,
    "explanation": "Duplicate detection and cleaning address inflated observations; rules should preserve auditability.",
    "source": "02_AI_for_Business_Booklet, Week 04, Data cleaning",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04 / Data cleaning",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "AIB",
      "week": 4,
      "booklet_locator": "02_AI_for_Business_Booklet, Week 04, Data cleaning",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-074",
    "module": "AIB",
    "week": 5,
    "topic": "EU AI Act risk framework",
    "stem": "Which application category receives the most stringent obligations among permitted risk classes under the EU AI Act framework?",
    "choices": [
      "High-risk AI systems",
      "Every minimal-risk calculator",
      "All spreadsheets regardless of use",
      "Every generative text output as an unacceptable-risk practice"
    ],
    "correct": 0,
    "explanation": "The AI Act requires substantial safeguards for designated high-risk uses, while unacceptable-risk practices may be prohibited.",
    "source": "02_AI_for_Business_Booklet, Week 05, AI Act risk levels",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 05 / AI Act risk levels",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-9",
      "locator": "AI Act Article 9 high-risk risk-management system; Article 6 risk classification, https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6",
      "scope": "High-risk permitted AI category with extensive obligations",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-075",
    "module": "AIB",
    "week": 5,
    "topic": "Meaningful oversight",
    "stem": "What makes human oversight of an AI-assisted business decision substantive rather than ceremonial?",
    "choices": [
      "The reviewer can understand limits, challenge outputs and intervene",
      "A person's name appears on a dashboard",
      "The human receives no information about error rates",
      "The model makes the final irreversible decision regardless"
    ],
    "correct": 0,
    "explanation": "Meaningful oversight needs the capability and authority to interpret, contest or override model-assisted outcomes.",
    "source": "02_AI_for_Business_Booklet, Week 05, Human oversight",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 05 / Human oversight",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14",
      "locator": "AI Act Article 14(4): human monitors, interprets, overrides and intervenes",
      "scope": "Oversight demands real authority and comprehension",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-076",
    "module": "INN",
    "week": 1,
    "topic": "Value capture",
    "stem": "In the expression Innovation = Invention × Commercialisation, why does the multiplicative form matter?",
    "choices": [
      "A strong invention cannot create commercial value through a wholly absent route to use",
      "Invention and commercialisation are always numerically measurable",
      "Every prototype is already adopted",
      "Distribution is irrelevant to innovation"
    ],
    "correct": 0,
    "explanation": "The formulation stresses that invention without implementation or a route to value is insufficient.",
    "source": "03_Innovation_Booklet, Week 01, Innovation equation",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 01 / Innovation equation",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "qualified",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 1,
      "booklet_locator": "03_Innovation_Booklet, Week 01, Innovation equation",
      "reviewed_at": "2026-10-09",
      "note": "The Innovation Week 1 lecturer uses Invention × Commercialisation as a pedagogical value-capture model. Do not mistake this for a universal definition of innovation: public and noncommercial implementation can qualify under the OECD Oslo Manual.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-077",
    "module": "INN",
    "week": 1,
    "topic": "Process versus strategic innovation",
    "stem": "A factory automates one production step without changing its value proposition. Which category best fits?",
    "choices": [
      "Process innovation",
      "Disruptive entry by definition",
      "A new national innovation system",
      "Strategic reinvention of the market"
    ],
    "correct": 0,
    "explanation": "Process innovation alters the way work is performed; strategic innovation changes the basis of value creation.",
    "source": "03_Innovation_Booklet, Week 01, Process and strategic innovation",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 01 / Process and strategic innovation",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 1,
      "booklet_locator": "03_Innovation_Booklet, Week 01, Process and strategic innovation",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-078",
    "module": "INN",
    "week": 2,
    "topic": "Quadruple Helix",
    "stem": "What distinguishes the Quadruple Helix from the Triple Helix model?",
    "choices": [
      "Inclusion of civil society and the public alongside industry, academia and government",
      "Replacement of universities by algorithms",
      "Exclusion of government",
      "Requirement that every innovation be patented"
    ],
    "correct": 0,
    "explanation": "Quadruple Helix extends university–industry–government interaction with society, citizens or media/cultural actors.",
    "source": "03_Innovation_Booklet, Week 02, Innovation systems",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 02 / Innovation systems",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 2,
      "booklet_locator": "03_Innovation_Booklet, Week 02, Innovation systems",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-079",
    "module": "INN",
    "week": 2,
    "topic": "Appropriability",
    "stem": "What is an appropriability regime intended to influence?",
    "choices": [
      "How innovators can capture returns from knowledge and invention",
      "The height of a database table",
      "How well a model tokenises sentences",
      "A project's calendar dates only"
    ],
    "correct": 0,
    "explanation": "Appropriability concerns patents, secrecy and other conditions affecting how innovators retain benefits.",
    "source": "03_Innovation_Booklet, Week 02, Appropriability regimes",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 02 / Appropriability regimes",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 2,
      "booklet_locator": "03_Innovation_Booklet, Week 02, Appropriability regimes",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-080",
    "module": "INN",
    "week": 3,
    "topic": "Foresight biases",
    "stem": "A strategy team searches only for evidence supporting its preferred 2040 scenario. Which bias is most directly illustrated?",
    "choices": [
      "Confirmation bias",
      "Sampling of hold-out test records",
      "Random exploration",
      "Bayesian calibration"
    ],
    "correct": 0,
    "explanation": "Confirmation bias selectively favours evidence consistent with existing beliefs.",
    "source": "03_Innovation_Booklet, Week 03, Foresight biases",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 03 / Foresight biases",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 3,
      "booklet_locator": "03_Innovation_Booklet, Week 03, Foresight biases",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-081",
    "module": "INN",
    "week": 3,
    "topic": "Complicated versus complex",
    "stem": "Which project is more clearly complex rather than merely complicated?",
    "choices": [
      "Changing urban travel behaviour through interacting incentives, norms and feedback",
      "Assembling a machine from a validated fixed blueprint",
      "Sorting a fixed set of numbered files",
      "Following a stable arithmetic conversion"
    ],
    "correct": 0,
    "explanation": "Complex systems involve adaptation, changing responses and feedback that reduce predictability.",
    "source": "03_Innovation_Booklet, Week 03, Complex systems",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 03 / Complex systems",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 3,
      "booklet_locator": "03_Innovation_Booklet, Week 03, Complex systems",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-082",
    "module": "INN",
    "week": 4,
    "topic": "Futures wheel",
    "stem": "A team maps second- and third-order consequences of one emerging change. Which foresight tool fits?",
    "choices": [
      "Futures Wheel",
      "Simple linear regression",
      "A data-normalisation table",
      "A legal checklist alone"
    ],
    "correct": 0,
    "explanation": "A Futures Wheel diagrams first-order and subsequent consequences around a development.",
    "source": "03_Innovation_Booklet, Week 04, Futures Wheel",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 04 / Futures Wheel",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 4,
      "booklet_locator": "03_Innovation_Booklet, Week 04, Futures Wheel",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-083",
    "module": "INN",
    "week": 4,
    "topic": "Roadmapping",
    "stem": "After backcasting from a preferred future, what best describes the resulting roadmap?",
    "choices": [
      "A sequenced set of milestones and actions towards that future",
      "A proof that the preferred future will occur",
      "A list of only historical megatrends",
      "A single model's confidence score"
    ],
    "correct": 0,
    "explanation": "Backcasting reasons backwards from a desired endpoint; roadmapping organises the resulting steps over time.",
    "source": "03_Innovation_Booklet, Week 04, Backcasting and roadmapping",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 04 / Backcasting and roadmapping",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "INN",
      "week": 4,
      "booklet_locator": "03_Innovation_Booklet, Week 04, Backcasting and roadmapping",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-084",
    "module": "DTR",
    "week": 1,
    "topic": "Digital transformation leadership",
    "stem": "In Westerman's digital-maturity archetypes, what characterises a Digirati organisation?",
    "choices": [
      "Strong digital capability combined with strong transformation leadership",
      "Weak digital capability and weak leadership",
      "High investment with no leadership",
      "No adoption despite effective change governance"
    ],
    "correct": 0,
    "explanation": "Digirati integrate digital capabilities with organisational transformation leadership.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Westerman digital maturity",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01 / Westerman digital maturity",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 1,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 01, Westerman digital maturity",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-085",
    "module": "DTR",
    "week": 1,
    "topic": "Transformation assessment",
    "stem": "What is the most convincing indicator of transformation instead of simple technology acquisition?",
    "choices": [
      "Changed operating model or value-creation logic supported by people and processes",
      "Number of newly purchased tablets",
      "A new software supplier name alone",
      "Repainting the server room"
    ],
    "correct": 0,
    "explanation": "Transformation concerns how organisations deliver value and organise work, not technology presence in isolation.",
    "source": "04_Digital_Transformation_Booklet, Week 01, Digital transformation overview",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01 / Digital transformation overview",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 1,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 01, Digital transformation overview",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-086",
    "module": "DTR",
    "week": 2,
    "topic": "Digital intensity",
    "stem": "A firm adopts ten of twelve items in the course's Digital Intensity Index. What band applies in the lecture's scoring?",
    "choices": [
      "Very high digital intensity",
      "Very low digital intensity",
      "Low digital intensity",
      "Not classified because the score is even"
    ],
    "correct": 0,
    "explanation": "The lecture bands are 0–3 very low, 4–6 low, 7–9 high and 10–12 very high.",
    "source": "04_Digital_Transformation_Booklet, Week 02, Digital Intensity Index",
    "origin": "booklet-derived",
    "verification": "verified",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 02 / Digital Intensity Index",
      "originalMaterialChecked": true,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited",
      "reviewed_at": "2026-10-09",
      "url": "https://ec.europa.eu/eurostat/web/interactive-publications/digitalisation-2024",
      "locator": "Eurostat Digitalisation in Europe 2024, Digital Intensity Index: 12 technologies, 10–12 = very high",
      "scope": "Lecture scoring aligns with Eurostat's 10–12 classification",
      "method": "Checked keyed answer, three alternatives and explanation against named primary technical, scholarly or EU authority; no assertion about Moodle official answers."
    }
  },
  {
    "id": "d4b-087",
    "module": "DTR",
    "week": 2,
    "topic": "Human-centred evaluation",
    "stem": "A cobot improves throughput but increases cognitive workload and near-miss incidents. What is the most defensible conclusion?",
    "choices": [
      "Evaluate both task productivity and human safety/workload before declaring success",
      "Throughput alone proves Industry 5.0 performance",
      "A cobot cannot produce any safety risk",
      "Worker feedback should be excluded as subjective"
    ],
    "correct": 0,
    "explanation": "Human-centred evaluation considers safety, workload, wellbeing and operational performance together.",
    "source": "04_Digital_Transformation_Booklet, Week 02, Human-centred design",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 02 / Human-centred design",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 2,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 02, Human-centred design",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-088",
    "module": "DTR",
    "week": 3,
    "topic": "General-purpose technology",
    "stem": "Why can adoption of a general-purpose technology initially produce uneven benefits across organisations?",
    "choices": [
      "Complementary skills, workflows and infrastructure develop at different rates",
      "Every firm has identical implementation conditions",
      "The technology changes no human tasks",
      "Adoption automatically standardises management quality"
    ],
    "correct": 0,
    "explanation": "General-purpose technologies depend on complementary investments and organisational adaptation.",
    "source": "04_Digital_Transformation_Booklet, Week 03, General-purpose technology",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 03 / General-purpose technology",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 3,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 03, General-purpose technology",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-089",
    "module": "DTR",
    "week": 3,
    "topic": "Skill retention",
    "stem": "Which measurement best complements a reported AI productivity gain in a learning-intensive role?",
    "choices": [
      "Whether workers retain judgement and independent task competence",
      "Only the number of generated paragraphs",
      "How confident the chatbot sounds",
      "The number of interface animations"
    ],
    "correct": 0,
    "explanation": "Productivity must be evaluated alongside effects on cognitive skill development, judgement and autonomy.",
    "source": "04_Digital_Transformation_Booklet, Week 03, Cognitive offloading and teaming",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 03 / Cognitive offloading and teaming",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 3,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 03, Cognitive offloading and teaming",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-090",
    "module": "DTR",
    "week": 4,
    "topic": "Commodification",
    "stem": "A platform packages behaviour-derived data to sell advertisers targeted segments. Which mechanism is particularly evident?",
    "choices": [
      "Commodification",
      "Analog digitisation",
      "Random forest training",
      "Physical inventory counting"
    ],
    "correct": 0,
    "explanation": "Commodification turns data and activities into commercial value or marketable products.",
    "source": "04_Digital_Transformation_Booklet, Week 04, Platform mechanisms",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 04 / Platform mechanisms",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 4,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 04, Platform mechanisms",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  },
  {
    "id": "d4b-091",
    "module": "DTR",
    "week": 4,
    "topic": "Platform power",
    "stem": "What is the main governance concern when a platform controls infrastructure, intermediary services and the user interface?",
    "choices": [
      "Vertical integration can concentrate control over access and visibility",
      "The platform loses all capacity to influence markets",
      "Interoperability becomes automatic",
      "Data collection must legally cease"
    ],
    "correct": 0,
    "explanation": "Vertical integration across layers can concentrate infrastructural and informational power.",
    "source": "04_Digital_Transformation_Booklet, Week 04, Vertical integration and platform power",
    "origin": "booklet-derived",
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 04 / Vertical integration and platform power",
      "originalMaterialChecked": false,
      "review_type": "booklet-concept-grounding",
      "note": "Original lecture/reading and lecturer key not independently audited"
    },
    "course_alignment": {
      "status": "supported",
      "source_type": "private D4B summary booklet",
      "module": "DTR",
      "week": 4,
      "booklet_locator": "04_Digital_Transformation_Booklet, Week 04, Vertical integration and platform power",
      "reviewed_at": "2026-10-09",
      "note": "The correct choice and three distractors were reviewed against the conceptual distinction described in the specified module-week booklet; this is not a Moodle grading confirmation.",
      "original_moodle_key_checked": false,
      "original_lecture_slides_directly_checked": false
    }
  }
]);
