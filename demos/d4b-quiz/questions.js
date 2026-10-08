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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01, Model families",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 01, Model families",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02, Embeddings",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03, Attention",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03, BERT versus GPT",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, Heuristic search",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, Search strategies",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, Minimax",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "03_Innovation_Booklet, Week 02, Disruption",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Key distinctions",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Vial process",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 02, Contextual embeddings",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 03, Attention",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04, Inference pipelines",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "01_Generative_AI_Booklet, Week 04, Decoding",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 02, A-star search",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03, Machine-learning tasks",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03, Validation",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 03, Data leakage",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Database design",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Database modelling",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "02_AI_for_Business_Booklet, Week 04, Imbalanced classes",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 01, Digital stages",
      "originalMaterialChecked": false
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
    "verification": "pending",
    "evidence": {
      "source": "04_Digital_Transformation_Booklet, Week 02, Industry 5.0",
      "originalMaterialChecked": false
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
    }
  }
]);
