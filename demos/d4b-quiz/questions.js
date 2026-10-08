/* Original practice questions distilled from the user's D4B booklets; no private booklet text is embedded. */
window.D4B_QUESTIONS = Object.freeze([
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
    "source": "01_Generative_AI_Booklet, Week 01, Model families"
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
    "source": "01_Generative_AI_Booklet, Week 01, Model families"
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
    "source": "01_Generative_AI_Booklet, Week 02, Embeddings"
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
    "source": "01_Generative_AI_Booklet, Week 02, Embeddings"
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
    "source": "01_Generative_AI_Booklet, Week 03, Attention"
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
    "source": "01_Generative_AI_Booklet, Week 03, BERT versus GPT"
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
    "source": "01_Generative_AI_Booklet, Week 05, Prompt engineering"
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
    "source": "02_AI_for_Business_Booklet, Week 01, Key distinctions"
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
    "source": "02_AI_for_Business_Booklet, Week 02, Heuristic search"
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
    "source": "02_AI_for_Business_Booklet, Week 02, Search strategies"
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
    "source": "02_AI_for_Business_Booklet, Week 02, Minimax"
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
    "source": "02_AI_for_Business_Booklet, Week 05, Ethical and social implications"
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
    "source": "03_Innovation_Booklet, Week 01, Key distinctions"
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
    "source": "03_Innovation_Booklet, Week 01, Complementary assets"
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
    "source": "03_Innovation_Booklet, Week 02, Disruption"
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
    "source": "03_Innovation_Booklet, Week 04, Foresight"
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
    "source": "04_Digital_Transformation_Booklet, Week 01, Key distinctions"
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
    "source": "04_Digital_Transformation_Booklet, Week 01, Westerman typology"
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
    "source": "04_Digital_Transformation_Booklet, Week 01, Vial process"
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
    "source": "04_Digital_Transformation_Booklet, Week 01, Societal lens"
  }
]);