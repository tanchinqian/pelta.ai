/*
 * Build a derived, queryable NIST AI RMF function reference from the full playbook.
 * Run: node scripts/build-nist-functions.js
 * Reads: data/nist_ai_rmf_playbook.json
 * Writes: data/nist_ai_rmf_functions.json
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'data', 'nist_ai_rmf_playbook.json');
const OUTPUT = path.join(__dirname, '..', 'data', 'nist_ai_rmf_functions.json');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'that', 'this', 'from', 'their', 'they', 'such', 'may', 'can', 'will',
  'should', 'into', 'within', 'about', 'below', 'above', 'other', 'been', 'have', 'has', 'had', 'not', 'but',
  'than', 'when', 'where', 'which', 'while', 'during', 'through', 'between', 'among', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'some',
  'what', 'who', 'why', 'how', 'its', 'his', 'her', 'our', 'your', 'them', 'these', 'those', 'such',
  'system', 'systems', 'model', 'models', 'ai', 'organization', 'organizational', 'process', 'processes',
  'risk', 'risks', 'management', 'policies', 'procedures', 'documentation', 'document', 'data', 'use',
  'used', 'using', 'based', 'related', 'include', 'includes', 'including', 'example', 'examples',
  'practice', 'practices', 'approach', 'approaches', 'activity', 'activities', 'standard', 'standards',
  'reference', 'references', 'resource', 'resources', 'section', 'category', 'function', 'functions',
  'across', 'address', 'addresses', 'establish', 'establishes', 'consider', 'considers', 'potential',
  'ensure', 'ensures', 'appropriate', 'necessary', 'relevant', 'specific', 'similar', 'different', 'various',
  'without', 'make', 'made', 'makes', 'take', 'takes', 'taken', 'given', 'provided', 'provide', 'provides',
  'identify', 'identifies', 'need', 'needs', 'needed', 'required', 'require', 'requires', 'enable', 'enables',
  'support', 'supports', 'detail', 'details', 'outlined', 'define', 'defines', 'defined', 'clear', 'clearly',
  'regular', 'regularly', 'current', 'currently', 'particular', 'particularly', 'general', 'generally',
  'common', 'commonly', 'key', 'additional', 'prior', 'follow', 'follows', 'following', 'evaluate', 'evaluates',
  'assess', 'assesses', 'determine', 'determines', 'understand', 'understands', 'maintain', 'maintains',
  'develop', 'develops', 'implement', 'implements', 'implementing', 'operate', 'operates', 'perform', 'performs',
  'carry', 'carries', 'conduct', 'conducts', 'inform', 'informs', 'work', 'works', 'working', 'help', 'helps',
  'facilitate', 'facilitates', 'enhance', 'enhances', 'improve', 'improves', 'integrate', 'integrates', 'align',
  'aligns', 'reflect', 'reflects', 'connect', 'connects', 'result', 'results', 'resulting', 'cause', 'causes',
  'causing', 'effect', 'effects', 'affect', 'affects', 'affecting', 'impact', 'impacts', 'lead', 'leads', 'leading',
  'contribute', 'contributes', 'due', 'because', 'therefore', 'thus', 'however', 'although', 'though', 'whether',
  'either', 'neither', 'also', 'only', 'just', 'even', 'still', 'already', 'yet', 'always', 'never', 'sometimes',
  'often', 'frequently', 'usually', 'typically', 'generally', 'broadly', 'widely', 'fully', 'partly', 'partially',
  'particularly', 'especially', 'notably', 'significantly', 'substantially', 'considerably', 'likely', 'unlikely',
  'possible', 'possibly', 'probably', 'actual', 'actually', 'specifically', 'certain', 'certainly', 'available',
  'applicable', 'suitable', 'pertinent', 'sufficient', 'insufficient', 'adequate', 'inadequate', 'effective',
  'effectively', 'efficacy', 'efficient', 'efficiently', 'accurate', 'accurately', 'correct', 'incorrect', 'precise',
  'precisely', 'reliable', 'reliably', 'valid', 'validity', 'validated', 'robust', 'resilient', 'secure', 'safe',
  'private', 'fair', 'biased', 'transparent', 'explainable', 'interpretable', 'accountable', 'trustworthy',
  'trust', 'responsible', 'responsibility', 'ethical', 'ethics', 'legal', 'legally', 'regulatory', 'regulation',
  'compliance', 'compliant', 'governance', 'govern', 'governed', 'governing', 'government', 'map', 'mapping',
  'mapped', 'measure', 'measured', 'measurement', 'measuring', 'manage', 'managed', 'managing', 'monitor',
  'monitored', 'monitoring', 'respond', 'response', 'responded', 'responding', 'test', 'testing', 'tested',
  'evaluation', 'evaluated', 'assessment', 'assessed', 'validate', 'validation', 'verify', 'verification', 'verified',
  'documented', 'report', 'reported', 'reporting', 'record', 'recorded', 'recording', 'track', 'tracked', 'tracking',
  'review', 'reviewed', 'reviewing', 'audit', 'audited', 'auditing', 'control', 'controlled', 'controlling', 'oversight',
  'supervise', 'supervised', 'supervision', 'coordinate', 'coordinated', 'coordination', 'communicate', 'communication',
  'communicated', 'disclose', 'disclosure', 'disclosed', 'share', 'shared', 'sharing', 'collaborate', 'collaboration',
  'collaborated', 'participate', 'participation', 'participated', 'engage', 'engagement', 'engaged', 'involve',
  'involvement', 'involved', 'included', 'inclusion', 'exclude', 'excluded', 'excluding', 'cover', 'covered', 'covering',
  'addressed', 'addressing', 'apply', 'applied', 'applying', 'applicable', 'requirement', 'requirements', 'needing',
  'sufficient', 'must', 'shall', 'could', 'would', 'might', 'cannot', 'won', 'don', 'does', 'doesn', 'did', 'didn',
  'hasn', 'haven', 'hadn', 'isn', 'aren', 'wasn', 'weren', 'being', 'done', 'gotten', 'came', 'coming', 'went', 'gone',
  'going', 'saw', 'seen', 'knew', 'known', 'thought', 'told', 'gave', 'given', 'found', 'put', 'puts', 'kept', 'lets',
  'began', 'begun', 'seemed', 'showed', 'shown', 'played', 'ran', 'moved', 'lived', 'believed', 'brought', 'happened',
  'wrote', 'written', 'sat', 'stood', 'lost', 'paid', 'met', 'continued', 'sets', 'learned', 'changed', 'led', 'understood',
  'watched', 'followed', 'stopped', 'created', 'spoke', 'spoken', 'read', 'allowed', 'added', 'spent', 'grew', 'grown',
  'opened', 'walked', 'offered', 'remembered', 'loved', 'considered', 'appeared', 'bought', 'waited', 'served', 'died',
  'sent', 'expected', 'built', 'stayed', 'fell', 'fallen', 'reached', 'killed', 'remained', 'suggested', 'raised', 'passed',
  'sold', 'decided', 'pulled', 'cared', 'returned', 'explained', 'carried', 'developed', 'hoped', 'drove', 'driven', 'broke',
  'broken', 'received', 'agreed', 'supported', 'removed', 'described', 'accepted', 'reduced', 'established', 'joined',
  'maintained', 'discovered', 'contained', 'avoided', 'ensured', 'protected', 'occurred', 'realized', 'represented',
  'argued', 'failed', 'relate', 'claimed', 'complained', 'replaced', 'missed', 'improved', 'existed', 'encouraged',
  'referred', 'tended', 'completed', 'lain', 'lying', 'laid', 'sought', 'chose', 'chosen', 'dealt', 'fought', 'lied', 'shot',
  'arose', 'arisen', 'beaten', 'became', 'become', 'bent', 'bound', 'bitten', 'blew', 'blown', 'burnt', 'burst', 'caught',
  'clung', 'cost', 'crept', 'dug', 'drew', 'drawn', 'dreamt', 'drank', 'drunk', 'ate', 'eaten', 'fed', 'felt', 'fit', 'fled',
  'flung', 'flew', 'flown', 'forbade', 'forbidden', 'forgot', 'forgotten', 'forgave', 'forgiven', 'froze', 'frozen', 'gotten',
  'ground', 'hung', 'hidden', 'held', 'hurt', 'knelt', 'learnt', 'left', 'lent', 'lit', 'meant', 'mistook', 'mistaken',
  'misunderstood', 'overcame', 'overtook', 'overtaken', 'proved', 'proven', 'quit', 'rode', 'ridden', 'rang', 'rung', 'rose',
  'risen', 'sawed', 'sawn', 'said', 'sewed', 'sewn', 'shook', 'shaken', 'shone', 'shrank', 'shrunk', 'shut', 'sang', 'sung',
  'sank', 'sunk', 'slept', 'slid', 'slung', 'slunk', 'smelt', 'snuck', 'sped', 'spelt', 'spilt', 'spun', 'spat', 'split',
  'spread', 'sprang', 'sprung', 'stole', 'stolen', 'stuck', 'stung', 'stank', 'stunk', 'strode', 'stridden', 'struck', 'stricken',
  'strung', 'strove', 'striven', 'swore', 'sworn', 'swept', 'swelled', 'swollen', 'swam', 'swum', 'swung', 'took', 'taught',
  'tore', 'torn', 'told', 'threw', 'thrown', 'thrust', 'trod', 'trodden', 'underwent', 'undergone', 'undertook', 'undertaken',
  'undid', 'undone', 'woke', 'woken', 'wore', 'worn', 'wove', 'woven', 'wept', 'won', 'wound', 'withdrew', 'withdrawn',
  'withheld', 'withstood', 'wrung', 'wrote',
]);

const FUNCTION_DEFINITIONS = {
  Govern:
    'Govern cultivates and implements a culture of risk management within organizations designing, developing, deploying, evaluating, or acquiring AI systems. It establishes processes to identify, understand, and communicate risk tolerance, and ensures risk management is integrated into organizational policies and procedures.',
  Map:
    'Map establishes the context to frame AI risks. It identifies intended use, deployment setting, stakeholders, and the potential positive and negative impacts of the AI system on people, groups, communities, organizations, and society.',
  Measure:
    'Measure employs tools, techniques, and methodologies to analyze, assess, benchmark, and monitor AI risk and related impacts. It uses knowledge gathered from Map and prior Measure activities to evaluate risks for trustworthy characteristics.',
  Manage:
    'Manage allocates risk resources to mapped and measured risks on an ongoing basis. It includes responding to, recovering from, and communicating about incidents or events, and plans for regular monitoring and improvement.',
};

// Curated domain keywords to supplement auto-derived ones.
const GENERIC_WORDS = new Set([
  '-', 'place', 'places', 'team', 'teams', 'issues', 'issue', 'human', 'humans', 'concerns', 'concern', 'efforts',
  'effort', 'information', 'individuals', 'individual', 'organizations', 'organization', 'technical', 'experience',
  'expertise', 'external', 'internal', 'negative', 'likelihood', 'plans', 'plan', 'poor', 'groups', 'group',
  'best', 'business', 'critical', 'decisions', 'decision', 'existing', 'industry', 'industries', 'tasks', 'task',
  'throughout', 'understanding', 'users', 'user', 'deployed', 'implementation', 'impacted', 'incidents',
  'personnel', 'existing', 'understanding', 'throughout',
  'range', 'ranges', 'size', 'sizes', 'level', 'levels', 'number', 'numbers', 'type', 'types', 'kind', 'kinds',
  'form', 'forms', 'part', 'parts', 'piece', 'pieces', 'lot', 'lots', 'bit', 'set', 'sets', 'way', 'ways',
  'time', 'times', 'period', 'periods', 'year', 'years', 'month', 'months', 'day', 'days', 'hour', 'hours',
  'minute', 'minutes', 'second', 'seconds', 'moment', 'moments', 'point', 'points', 'area', 'areas', 'region',
  'regions', 'location', 'locations', 'site', 'sites', 'contexts', 'context', 'conditions', 'condition',
  'factors', 'factor', 'elements', 'element', 'aspects', 'aspect', 'components', 'component', 'features',
  'feature', 'attributes', 'attribute', 'properties', 'property', 'characteristics', 'characteristic',
  'dimensions', 'dimension', 'perspectives', 'perspective', 'viewpoints', 'viewpoint', 'stakeholders',
  'outcomes', 'outcome', 'outputs', 'output', 'inputs', 'input', 'results', 'result', 'effects', 'effect',
  'impacts', 'impact', 'consequences', 'consequence', 'benefits', 'benefit', 'costs', 'cost', 'values', 'value',
  'goals', 'goal', 'objectives', 'objective', 'aims', 'aim', 'purposes', 'purpose', 'intents', 'intent',
  'needs', 'need', 'requirements', 'requirement', 'expectations', 'expectation', 'preferences', 'preference',
  'interests', 'interest', 'motivations', 'motivation', 'drivers', 'driver', 'incentives', 'incentive',
  'constraints', 'constraint', 'limitations', 'limitation', 'restrictions', 'restriction', 'assumptions',
  'assumption', 'dependencies', 'dependency', 'relationships', 'relationship', 'interactions', 'interaction',
  'connections', 'connection', 'linkages', 'linkage', 'interfaces', 'interface', 'boundaries', 'boundary',
  'scopes', 'scope', 'scales', 'scale', 'magnitudes', 'magnitude', 'frequencies', 'frequency', 'durations',
  'duration', 'volumes', 'volume', 'quantities', 'quantity', 'amounts', 'amount', 'degrees', 'degree',
  'extents', 'extent', 'measures', 'measure', 'metrics', 'metric', 'indicators', 'indicator', 'signals',
  'signal', 'signs', 'sign', 'markers', 'marker', 'evidence', 'proof', 'confirmation',
]);

const CURATED_KEYWORDS = {
  Govern: [
    'policy', 'policies', 'governance', 'compliance', 'legal', 'regulatory', 'law', 'oversight', 'accountability',
    'audit', 'ethics', 'board', 'executive', 'risk tolerance', 'roles', 'responsibilities', 'training',
    'inventory', 'decommission', 'incident response', 'whistleblower', 'diversity', 'stakeholder',
    'agent', 'agents', 'autonomous', 'automation', 'automated', 'third party', 'third-party', 'vendor',
    'procurement', 'contract', 'agreement', 'intellectual property', 'ip', 'liability', 'license',
    'document', 'documents', 'legal', 'lawyer', 'attorney', 'nda', 'client', 'clients', 'hr', 'human resources',
  ],
  Map: [
    'context', 'use case', 'purpose', 'intended use', 'deployment', 'deploy', 'user', 'users', 'community',
    'stakeholder', 'impact', 'impact assessment', 'harm', 'benefit', 'assumption', 'limitation',
    'categorization', 'context of use', 'task', 'tasks', 'automation', 'automate', 'human-ai', 'interaction',
    'feedback', 'problem formulation', 'prompt', 'prompts', 'natural language', 'chatbot', 'chat',
    'customer', 'employee', 'patient', 'applicant', 'candidate', 'borrower', 'consumer',
    'meeting', 'meetings', 'summarize', 'summary', 'summaries', 'transcribe', 'transcription', 'note', 'notes',
    'notetaking', 'writing', 'write', 'draft', 'drafting', 'brainstorm', 'brainstorming', 'research',
    'search', 'searches', 'email', 'emails', 'communication', 'messaging', 'message', 'messages',
    'video', 'image', 'images', 'design', 'marketing', 'content', 'advertising', 'social media', 'blog',
  ],
  Measure: [
    'test', 'testing', 'evaluation', 'validation', 'verification', 'metric', 'metrics', 'performance',
    'accuracy', 'bias', 'fairness', 'robustness', 'security', 'privacy', 'safety', 'reliability', 'validity',
    'explainability', 'interpretability', 'transparency', 'monitoring', 'benchmark', 'measurement',
    'statistical', 'quality', 'drift', 'error', 'uncertainty', 'confidence', 'code', 'coding', 'coder',
    'source code', 'software', 'program', 'programming', 'generate', 'generates', 'generated', 'generation',
    'write', 'writes', 'writing', 'review', 'peer review', 'sast', 'vulnerability', 'bug', 'defect',
    'analysis', 'analytics', 'analyze', 'translation', 'translate', 'translating', 'language', 'languages',
    'voice', 'audio', 'sound', 'recording', 'record', 'records', 'transcribe', 'transcription', 'speech',
  ],
  Manage: [
    'monitor', 'monitoring', 'respond', 'response', 'incident', 'event', 'feedback', 'appeal', 'override',
    'recourse', 'mitigate', 'mitigation', 'risk response', 'manage', 'management', 'continuous',
    'improvement', 'remediation', 'corrective', 'recovery', 'communicate', 'escalation', 'maintenance',
    'deploy', 'deployment', 'production', 'live', 'release', 'rollback', 'incident management',
    'human in the loop', 'human-in-the-loop', 'hitl', 'override', 'appeal', 'opt-out',
    'assistant', 'companion', 'agent', 'agents', 'meeting', 'meetings', 'call', 'calls', 'video', 'voice',
  ],
};

function tokenize(text) {
  return (
    String(text)
      .toLowerCase()
      // Remove markdown URLs like [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove standalone URLs
      .replace(/https?:\/\/\S+/g, '')
      // Keep letters, numbers, spaces, and hyphens
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && w !== '-' && (w.length >= 4 || w.includes('-')))
      .filter((w) => !STOP_WORDS.has(w))
      .filter((w) => !GENERIC_WORDS.has(w))
  );
}

function extractPhrases(text, phrases) {
  const lower = String(text).toLowerCase();
  return phrases.filter((p) => lower.includes(p.toLowerCase()));
}

function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

  const byFunction = {
    Govern: [],
    Map: [],
    Measure: [],
    Manage: [],
  };

  for (const entry of raw) {
    const fn = entry.type;
    if (byFunction[fn]) byFunction[fn].push(entry);
  }

  const derived = Object.entries(byFunction).map(([fn, entries]) => {
    // Aggregate textual content without altering it.
    const descriptions = entries.map((e) => e.description).filter(Boolean);
    const topics = [...new Set(entries.flatMap((e) => e.Topic || []))];
    const actors = [...new Set(entries.flatMap((e) => e.AI_Actors || []))];

    const concerns = [
      ...descriptions,
      // Add a few representative topics/actors so the model sees the breadth.
      `Relevant topics: ${topics.slice(0, 12).join(', ')}${topics.length > 12 ? '...' : ''}`,
    ];

    // Build keyword corpus from descriptions, topics, actors, and about/actions text.
    const corpus = entries
      .map((e) => [e.description, e.section_about, e.section_actions, ...(e.Topic || []), ...(e.AI_Actors || [])].join(' '))
      .join(' ');

    const tokens = tokenize(corpus);
    const freq = new Map();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);

    // Pick top frequency-derived keywords, then add curated ones and bigrams/phrases.
    const topDerived = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([w]) => w);

    const curated = CURATED_KEYWORDS[fn] || [];
    const matchedPhrases = extractPhrases(corpus, [
      ...curated,
      'risk tolerance',
      'human oversight',
      'adversarial attack',
      'privacy preserving',
      'data quality',
      'third party',
      'incident response',
      'model documentation',
    ]);

    const keywords = [...new Set([...topDerived, ...curated, ...matchedPhrases])].sort();

    return {
      function: fn,
      definition: FUNCTION_DEFINITIONS[fn],
      concerns,
      keywords,
      sourceCount: entries.length,
    };
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(derived, null, 2));
  console.log(`Wrote ${OUTPUT}`);
  for (const d of derived) {
    console.log(`- ${d.function}: ${d.sourceCount} sections, ${d.keywords.length} keywords`);
  }
}

main();
