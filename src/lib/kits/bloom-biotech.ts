/**
 * Bloom Biotech starter kit — a WhatsApp sales + support setup for an
 * agri-biotech input maker (https://bloombiotech.netlify.app).
 *
 * Every product fact below is taken from Bloom's own site. Prices are
 * deliberately absent: Bloom quotes per crop and acreage, so the bot
 * collects those and hands the customer to an agronomist instead.
 *
 * Journey the kit wires up:
 *   "Hi" ─▶ welcome menu ─▶ product / crop info ─▶ price quote
 *     │         (flow)        tags "Interested: …"    tags "Wants quote",
 *     │                        ─▶ deal in pipeline      collects details,
 *     │                           (automation)          hands off + note
 *   "dealer" ─▶ dealer questions ─▶ deal + handoff
 */

import type { KitFlow, KitFlowNode, StarterKit } from './types'

// ------------------------------------------------------------
// Names shared between tags, flows and automations
// ------------------------------------------------------------

const TAG = {
  newLead: 'New lead',
  sanjiveeni: 'Interested: Bio Sanjiveeni',
  samruddhi: 'Interested: Bhu Samruddhi',
  astra: 'Interested: Bio Astra',
  wantsQuote: 'Wants quote',
  askedExpert: 'Asked for expert',
  dealer: 'Dealer enquiry',
  coffee: 'Crop: Coffee',
  pepper: 'Crop: Black pepper',
  pomegranate: 'Crop: Pomegranate',
} as const

const PIPELINE = 'Bloom Biotech sales'
const STAGE = {
  newEnquiry: 'New enquiry',
  interested: 'Interested',
  quoteSent: 'Quote sent',
  negotiation: 'Negotiation',
  won: 'Order won',
} as const

const PHONE = '+91 88845 68019'
const EMAIL = 'bloombiotech@gmail.com'
const NO_TANK_MIX =
  '⚠️ Never tank-mix with fungicides, pesticides or insecticides — these are living organisms and chemicals kill them.'

// ------------------------------------------------------------
// Node helpers — keep the flow definitions readable
// ------------------------------------------------------------

const start = (next: string): KitFlowNode => ({
  node_key: 'start',
  node_type: 'start',
  config: { next_node_key: next },
})

const say = (key: string, text: string, next: string): KitFlowNode => ({
  node_key: key,
  node_type: 'send_message',
  config: { text, next_node_key: next },
})

const tag = (key: string, tagName: string, next: string): KitFlowNode => ({
  node_key: key,
  node_type: 'set_tag',
  config: { mode: 'add', tag_name: tagName, next_node_key: next },
})

const ask = (key: string, prompt: string, varKey: string, next: string): KitFlowNode => ({
  node_key: key,
  node_type: 'collect_input',
  config: { prompt_text: prompt, var_key: varKey, next_node_key: next },
})

const handoff = (key: string, note: string): KitFlowNode => ({
  node_key: key,
  node_type: 'handoff',
  config: { note },
})

// ------------------------------------------------------------
// Product catalogue — shared by the welcome and product flows
// ------------------------------------------------------------

function catalogueNodes(): KitFlowNode[] {
  return [
    {
      node_key: 'products',
      node_type: 'send_list',
      config: {
        text: 'Here are our products 🌱 Tap one to see what it does and how to use it.',
        button_label: 'View products',
        footer_text: 'Made in Chikkamagaluru with ICAR-IIHR',
        sections: [
          {
            title: 'Our products',
            rows: [
              {
                reply_id: 'product_sanjiveeni',
                title: 'Bio Sanjiveeni',
                description: 'Microbial consortium · feeds roots & fights soil disease',
                next_node_key: 'pick_sanjiveeni',
              },
              {
                reply_id: 'product_samruddhi',
                title: 'Bhu Samruddhi',
                description: 'Liquid consortium · spray or drip at 10 ml per litre',
                next_node_key: 'pick_samruddhi',
              },
              {
                reply_id: 'product_astra',
                title: 'Bio Astra',
                description: 'Streptomyces biocontrol · guards roots, grows more roots',
                next_node_key: 'pick_astra',
              },
            ],
          },
          {
            title: 'More',
            rows: [
              {
                reply_id: 'product_more',
                title: 'More products',
                description: 'Compost culture, Bio Hit, Jackpot and more',
                next_node_key: 'more_products',
              },
              {
                reply_id: 'product_help',
                title: 'Help me choose',
                description: "Tell us your crop and we'll suggest the right pack",
                next_node_key: 'crops',
              },
            ],
          },
        ],
      },
    },

    tag('pick_sanjiveeni', TAG.sanjiveeni, 'about_sanjiveeni'),
    say(
      'about_sanjiveeni',
      [
        '*Bio Sanjiveeni* 🌱',
        'One pack instead of three biofertilisers. It feeds the roots and protects them from disease.',
        '',
        '✅ *Adds nitrogen* — Azotobacter fixes it from the air',
        '✅ *Frees phosphorus & zinc* — Bacillus unlocks soil-bound nutrients',
        '✅ *Protects the roots* — Pseudomonas controls soil-borne disease',
        '✅ Certified organic · Arka Microbial Consortium (ICAR-IIHR)',
        '',
        '📦 5 kg carrier pack · use within 6 months of manufacture',
        '💧 Soil drench: 1 kg in 40 L of water at the root zone',
      ].join('\n'),
      'next_steps',
    ),

    tag('pick_samruddhi', TAG.samruddhi, 'about_samruddhi'),
    say(
      'about_samruddhi',
      [
        '*Bhu Samruddhi* 💧',
        'The liquid form of Bio Sanjiveeni — spray it on the crop or run it through drip.',
        '',
        '✅ Adds nitrogen and frees phosphorus & zinc',
        '✅ Protects roots against soil-borne fungal and bacterial disease',
        '✅ Safe and organic — non-hazardous to people, livestock and wildlife',
        '',
        '💧 10 ml per litre, as a foliar spray or through drip fertigation',
      ].join('\n'),
      'next_steps',
    ),

    tag('pick_astra', TAG.astra, 'about_astra'),
    say(
      'about_astra',
      [
        '*Bio Astra* 🛡️',
        'Three Streptomyces strains that guard the root zone and grow more roots.',
        '',
        '✅ *Guards the root zone* — releases natural antibiotics around the roots',
        "✅ *Grows more roots* — produces IAA and gibberellins, the plant's rooting hormones",
        '✅ Arka Actino Consortium — Bloom was first in India to licence it from ICAR-IIHR (2015)',
        '',
        '📦 Carrier pouch (5 kg) and liquid packs · use within 6 months of manufacture',
      ].join('\n'),
      'next_steps',
    ),

    say(
      'more_products',
      [
        '🌱 *We also make:*',
        '• *Bloom Compost Culture* — Arka Fermented Cocopeat culture that turns farm waste into compost',
        '• *Bio Hit* — Beauveria bassiana biocontrol',
        '• *Jackpot* — high-grade potassium humate for root health',
        '• *Bluderma* and *Blumonas*',
        '',
        "Tell us your crop and our agronomist will suggest the right pack and dose.",
      ].join('\n'),
      'next_steps',
    ),

    {
      node_key: 'next_steps',
      node_type: 'send_buttons',
      config: {
        text: 'Would you like a price for your farm? 💬 Prices depend on your crop and acreage, so we quote every farm personally.',
        buttons: [
          { reply_id: 'get_quote', title: '💰 Get price quote', next_node_key: 'quote_tag' },
          { reply_id: 'other_products', title: '🌿 Other products', next_node_key: 'products' },
          { reply_id: 'talk_expert', title: '📞 Talk to expert', next_node_key: 'expert_tag' },
        ],
      },
    },

    {
      node_key: 'crops',
      node_type: 'send_list',
      config: {
        text: "Which crop are you growing? 🌾 We'll suggest the right Bloom pack for it.",
        button_label: 'Choose your crop',
        sections: [
          {
            title: 'Crops',
            rows: [
              {
                reply_id: 'crop_coffee',
                title: 'Coffee',
                description: 'Root health, nutrition and soil biology',
                next_node_key: 'crop_coffee',
              },
              {
                reply_id: 'crop_pepper',
                title: 'Black pepper',
                description: 'Root zone protection and nutrition',
                next_node_key: 'crop_pepper',
              },
              {
                reply_id: 'crop_pomegranate',
                title: 'Pomegranate',
                description: 'Soil biology and root health',
                next_node_key: 'crop_pomegranate',
              },
              {
                reply_id: 'crop_other',
                title: 'Other crops',
                description: 'Floriculture and more',
                next_node_key: 'advice_other',
              },
            ],
          },
        ],
      },
    },

    tag('crop_coffee', TAG.coffee, 'advice_coffee'),
    say(
      'advice_coffee',
      [
        '☕ *For coffee*, growers use:',
        '• *Bio Sanjiveeni* — soil drench, 1 kg in 40 L of water, to feed the roots and protect them',
        '• *Bhu Samruddhi* — 10 ml per litre as a spray or through drip',
        '• *Bio Astra* — to guard the root zone and grow more roots',
        '',
        "Our agronomist will fit the schedule to your estate's age and soil.",
        '',
        NO_TANK_MIX,
      ].join('\n'),
      'next_steps',
    ),

    tag('crop_pepper', TAG.pepper, 'advice_pepper'),
    say(
      'advice_pepper',
      [
        '🌿 *For black pepper*, growers pair:',
        '• *Bio Sanjiveeni* — soil drench, 1 kg in 40 L of water, for root health and nutrition',
        '• *Bio Astra* — Streptomyces that guard the root zone and grow more roots',
        '• *Bhu Samruddhi* — 10 ml per litre through drip or as a spray',
        '',
        'Field-tested with ICAR-IIHR scientists on black pepper.',
        '',
        NO_TANK_MIX,
      ].join('\n'),
      'next_steps',
    ),

    tag('crop_pomegranate', TAG.pomegranate, 'advice_pomegranate'),
    say(
      'advice_pomegranate',
      [
        '🍎 *For pomegranate*, growers use:',
        '• *Bio Sanjiveeni* — soil drench, 1 kg in 40 L of water, to build soil biology',
        '• *Bhu Samruddhi* — 10 ml per litre as a spray or through drip',
        '',
        'Field-tested with ICAR-IIHR scientists on pomegranate.',
        '',
        NO_TANK_MIX,
      ].join('\n'),
      'next_steps',
    ),

    say(
      'advice_other',
      [
        '🌸 We also make packs for floriculture and many other crops.',
        '',
        "Tell our agronomist what you grow and they'll suggest the right product and schedule.",
      ].join('\n'),
      'next_steps',
    ),

    tag('quote_tag', TAG.wantsQuote, 'ask_name'),
    ask('ask_name', "Great, let's get you a price 💰\n\nFirst, what's your name?", 'name', 'ask_place'),
    ask('ask_place', 'Thanks {{vars.name}}! Which village or town is your farm in?', 'place', 'ask_acres'),
    ask('ask_acres', 'And roughly how many acres will you treat?', 'acres', 'quote_thanks'),
    say(
      'quote_thanks',
      [
        "Thank you {{vars.name}} 🙏 We've noted your request:",
        '📍 {{vars.place}}',
        '🌱 {{vars.acres}}',
        '',
        `Our agronomist will call you shortly with the best price for your farm. Need us sooner? Call ${PHONE}.`,
      ].join('\n'),
      'quote_handoff',
    ),
    handoff(
      'quote_handoff',
      '💰 Price quote request — name: {{vars.name}}, place: {{vars.place}}, area: {{vars.acres}}. Call back with pricing (see tags for the product / crop).',
    ),

    tag('expert_tag', TAG.askedExpert, 'expert_msg'),
    say(
      'expert_msg',
      [
        'Sure! 👨‍🌾 One of our agronomists will reply to you right here shortly.',
        '',
        `You can also call us on ${PHONE} or email ${EMAIL}.`,
      ].join('\n'),
      'expert_handoff',
    ),
    handoff('expert_handoff', '📞 Customer asked to talk to an agronomist.'),
  ]
}

// ------------------------------------------------------------
// Flows — listed most-specific first. Installation order is creation
// order, and when a message matches two keyword flows the older one
// wins, so "hi, I want a dealership" reaches the dealer flow.
// ------------------------------------------------------------

const DEALER_FLOW: KitFlow = {
  name: 'Bloom · Dealer & bulk enquiry',
  description:
    'Someone asks about dealership, distribution or bulk orders → collect their details, tag them and hand off to sales.',
  trigger_type: 'keyword',
  trigger_config: {
    keywords: [
      'dealer',
      'dealers',
      'dealership',
      'distributor',
      'distributors',
      'distributorship',
      'distribution',
      'wholesale',
      'bulk',
      'stockist',
      'reseller',
      'franchise',
    ],
    match_type: 'word',
  },
  entry_node_id: 'start',
  nodes: [
    start('dealer_tag'),
    tag('dealer_tag', TAG.dealer, 'dealer_intro'),
    say(
      'dealer_intro',
      'Thank you for your interest in partnering with *Bloom Biotech* 🤝\n\nA few quick questions so our sales team can reach you:',
      'd_name',
    ),
    ask('d_name', "What's your name?", 'name', 'd_business'),
    ask('d_business', "What's the name of your shop or business?", 'business', 'd_town'),
    ask('d_town', 'Which town or district do you cover?', 'town', 'd_thanks'),
    say(
      'd_thanks',
      `Thanks {{vars.name}}! 🙏 Our sales team will call you shortly about a dealership for {{vars.town}}.\n\nFor anything urgent, call ${PHONE}.`,
      'd_handoff',
    ),
    handoff(
      'd_handoff',
      '🤝 Dealer enquiry — name: {{vars.name}}, business: {{vars.business}}, area: {{vars.town}}.',
    ),
  ],
}

const PRODUCT_FLOW: KitFlow = {
  name: 'Bloom · Product enquiry',
  description:
    'Customer asks for products, prices or a product by name → show the catalogue, tag their interest and offer a price quote.',
  trigger_type: 'keyword',
  trigger_config: {
    keywords: [
      'product',
      'products',
      'catalogue',
      'catalog',
      'price',
      'prices',
      'pricing',
      'rate',
      'rates',
      'cost',
      'buy',
      'order',
      'quote',
      'sanjiveeni',
      'samruddhi',
      'astra',
      'fertiliser',
      'fertilizer',
      'biofertiliser',
      'biofertilizer',
    ],
    match_type: 'word',
  },
  entry_node_id: 'start',
  nodes: [start('products'), ...catalogueNodes()],
}

const WELCOME_FLOW: KitFlow = {
  name: 'Bloom · Welcome menu',
  description:
    'Greets anyone who says hi (and every new customer) as Bloom Biotech, then routes them to products, crop advice or an expert.',
  trigger_type: 'keyword',
  trigger_config: {
    keywords: [
      'hi',
      'hii',
      'hiii',
      'hai',
      'hello',
      'helo',
      'hey',
      'namaste',
      'namaskara',
      'namaskar',
      'menu',
      'bloom',
    ],
    match_type: 'word',
    also_on_first_message: true,
  },
  entry_node_id: 'start',
  nodes: [
    start('welcome'),
    {
      node_key: 'welcome',
      node_type: 'send_buttons',
      config: {
        text: [
          'Hey there 👋 This is *Bloom Biotech* 🌱',
          '',
          'We make licensed microbial inputs with ICAR-IIHR — for healthier soil, stronger roots and better yields. Growing microbes in Chikkamagaluru since 2013.',
          '',
          'How can we help you today?',
        ].join('\n'),
        footer_text: 'Bloom Biotech · Green biotechnology',
        buttons: [
          { reply_id: 'menu_products', title: '🌿 Our products', next_node_key: 'products' },
          { reply_id: 'menu_crops', title: '🌾 Crop solutions', next_node_key: 'crops' },
          { reply_id: 'menu_expert', title: '📞 Talk to expert', next_node_key: 'expert_tag' },
        ],
      },
    },
    ...catalogueNodes(),
  ],
}

// ------------------------------------------------------------
// Kit
// ------------------------------------------------------------

const productDealAutomation = (product: string, tagName: string) => ({
  name: `Bloom · ${product} enquiry → sales pipeline`,
  description: `When a customer picks ${product} in the bot, open a deal in the "${STAGE.interested}" stage so sales can follow up.`,
  trigger_type: 'tag_added' as const,
  trigger_config: { tag_name: tagName },
  is_active: true,
  steps: [
    {
      step_type: 'create_deal' as const,
      step_config: {
        pipeline_name: PIPELINE,
        stage_name: STAGE.interested,
        title: `${product} enquiry`,
        value: 0,
      },
    },
  ],
})

export const BLOOM_BIOTECH_KIT: StarterKit = {
  slug: 'bloom-biotech',
  name: 'Bloom Biotech',
  tagline: 'Agri-biotech WhatsApp sales & support — welcome menu, product catalogue, price quotes, dealer leads.',
  description:
    'Sets up a complete WhatsApp funnel for Bloom Biotech: the bot greets customers as Bloom, shows Bio Sanjiveeni, Bhu Samruddhi and Bio Astra, gives crop advice, and collects price-quote and dealer requests. Every interest is tagged, lands in the "Bloom Biotech sales" pipeline and shows up on the dashboard.',
  tryIt: [
    { send: 'Hi', expect: 'Greeting from Bloom Biotech with 3 buttons' },
    { send: 'products', expect: 'The product list — tap one to see details' },
    { send: 'Tap "💰 Get price quote"', expect: '3 quick questions, then an agent takes over' },
    { send: 'I want a dealership', expect: 'Dealer questions → deal in the pipeline' },
  ],

  tags: [
    { name: TAG.newLead, color: '#3b82f6' },
    { name: TAG.sanjiveeni, color: '#10b981' },
    { name: TAG.samruddhi, color: '#06b6d4' },
    { name: TAG.astra, color: '#8b5cf6' },
    { name: TAG.wantsQuote, color: '#ef4444' },
    { name: TAG.askedExpert, color: '#f97316' },
    { name: TAG.dealer, color: '#ec4899' },
    { name: TAG.coffee, color: '#f59e0b' },
    { name: TAG.pepper, color: '#f59e0b' },
    { name: TAG.pomegranate, color: '#f59e0b' },
  ],

  pipeline: {
    name: PIPELINE,
    stages: [
      { name: STAGE.newEnquiry, color: '#3b82f6' },
      { name: STAGE.interested, color: '#eab308' },
      { name: STAGE.quoteSent, color: '#f97316' },
      { name: STAGE.negotiation, color: '#8b5cf6' },
      { name: STAGE.won, color: '#22c55e' },
    ],
  },

  flows: [DEALER_FLOW, PRODUCT_FLOW, WELCOME_FLOW],

  automations: [
    {
      name: 'Bloom · Tag new WhatsApp leads',
      description: 'Every first-time sender gets the "New lead" tag, so new leads are easy to filter and broadcast to.',
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      is_active: true,
      steps: [{ step_type: 'add_tag', step_config: { tag_name: TAG.newLead } }],
    },
    productDealAutomation('Bio Sanjiveeni', TAG.sanjiveeni),
    productDealAutomation('Bhu Samruddhi', TAG.samruddhi),
    productDealAutomation('Bio Astra', TAG.astra),
    {
      name: 'Bloom · Price quote → assign to sales',
      description: 'When a customer asks for a price, assign the conversation to the team so someone calls back.',
      trigger_type: 'tag_added',
      trigger_config: { tag_name: TAG.wantsQuote },
      is_active: true,
      steps: [{ step_type: 'assign_conversation', step_config: { mode: 'round_robin' } }],
    },
    {
      name: 'Bloom · Dealer enquiry → sales pipeline',
      description: 'Dealer and bulk enquiries open a deal in "New enquiry" and are assigned to the team.',
      trigger_type: 'tag_added',
      trigger_config: { tag_name: TAG.dealer },
      is_active: true,
      steps: [
        {
          step_type: 'create_deal',
          step_config: {
            pipeline_name: PIPELINE,
            stage_name: STAGE.newEnquiry,
            title: 'Dealer / bulk enquiry',
            value: 0,
          },
        },
        { step_type: 'assign_conversation', step_config: { mode: 'round_robin' } },
      ],
    },
    {
      name: 'Bloom · Next-day quote follow-up',
      description:
        'Off by default. 20 hours after a price request, send a friendly check-in (inside WhatsApp\'s 24-hour reply window). Needs the automations cron job running.',
      trigger_type: 'tag_added',
      trigger_config: { tag_name: TAG.wantsQuote },
      is_active: false,
      steps: [
        { step_type: 'wait', step_config: { amount: 20, unit: 'hours' } },
        {
          step_type: 'send_message',
          step_config: {
            text: `Hi 👋 This is Bloom Biotech 🌱 Just checking in — did our agronomist reach you about your price quote? If you still need help, simply reply here or call ${PHONE}.`,
          },
        },
      ],
    },
  ],

  // Names match the Bloom drafts already in the demo account, so there
  // the installer skips them (existing wins) instead of adding
  // near-duplicates; a fresh account gets these versions.
  templates: [
    {
      name: 'bloom_welcome',
      category: 'Marketing',
      language: 'en',
      body_text:
        'Hi {{1}} 👋 This is Bloom Biotech 🌱\n\nWe make licensed microbial inputs with ICAR-IIHR for healthier soil and stronger roots — made in Chikkamagaluru since 2013.\n\nTap below to see our products, or reply with your crop and we will suggest the right pack.',
      footer_text: 'Bloom Biotech · Green biotechnology',
      buttons: [{ type: 'QUICK_REPLY', text: 'Show me products' }],
      sample_values: { body: ['Ravi'] },
    },
    {
      name: 'bloom_season_reminder',
      category: 'Marketing',
      language: 'en',
      body_text:
        'Hi {{1}} 🌱 A tip from Bloom Biotech for your {{2}}: a soil drench of Bio Sanjiveeni (1 kg in 40 L of water) at the root zone adds nitrogen, frees phosphorus and zinc, and protects the roots from soil-borne disease.\n\nReply *price* and we will quote for your farm.',
      footer_text: 'Never tank-mix with chemical sprays',
      buttons: [{ type: 'QUICK_REPLY', text: 'Get a price' }],
      sample_values: { body: ['Ravi', 'coffee estate'] },
    },
    {
      name: 'bloom_enquiry_followup',
      category: 'Utility',
      language: 'en',
      body_text:
        'Hi {{1}}, thank you for asking Bloom Biotech for a price on {{2}}. Our agronomist tried to reach you — reply here or call +91 88845 68019 and we will share the best price for your farm.',
      sample_values: { body: ['Ravi', 'Bio Astra'] },
    },
    {
      name: 'bloom_order_confirmed',
      category: 'Utility',
      language: 'en',
      body_text:
        'Hi {{1}}, your Bloom Biotech order {{2}} is confirmed ✅ Expected dispatch: {{3}}.\n\nPlease use the packs within 6 months of manufacture and never tank-mix them with fungicides, pesticides or insecticides.',
      sample_values: { body: ['Ravi', 'BB-1024', '12 October'] },
    },
  ],

  knowledge: [
    {
      title: 'Bloom Biotech — company and contact',
      content: [
        'Bloom Biotech is an agri-biotech company in Chikkamagaluru, Karnataka, India, making microbial inputs for agriculture since 2013: microbial consortia, biocontrols and crop nutrition.',
        'Bloom works with ICAR-IIHR (Indian Institute of Horticultural Research) and makes licensed microbial inputs at its own unit. Bloom was the first company in India to license the Arka Microbial Consortium and Arka Fermented Cocopeat from ICAR-IIHR (2013), followed by the Arka Actino Consortium (2015). Products were field-tested with IIHR scientists on pomegranate, black pepper and floriculture.',
        'Mission: good biotech products and technical help, so growers produce more for less.',
        `Phone / WhatsApp: ${PHONE}. Email: ${EMAIL}. Address: Sy. No. 259/1, Hampapura Bypass Road, Beekanahalli Village, Joythinagar, Chikkamagalur 577102. Instagram @bloom_biotech, Facebook bloombiotech. Website: https://bloombiotech.netlify.app`,
        'Pricing: Bloom does not publish prices. Quotes depend on the crop and the area (acres) to be treated. To get a price, the customer can type "price" in this chat and share their name, place and acreage; an agronomist then calls back.',
        'Dealers and distributors: type "dealer" in this chat to share your business details with the sales team.',
      ].join('\n\n'),
    },
    {
      title: 'Bloom Biotech — products',
      content: [
        'Bio Sanjiveeni: "One pack instead of three biofertilisers. It feeds the roots and protects them from disease." Contains Azotobacter (adds nitrogen by fixing it from the air), Bacillus (frees phosphorus and zinc held in the soil) and Pseudomonas (protects the roots by controlling soil-borne disease), on an Arka Microbial Consortium (AMC) carrier. Certified organic. 5 kg carrier pouch. Expiry 6 months from manufacture. Soil drench: 1 kg in 40 L of water at the root zone.',
        'Bhu Samruddhi: the liquid form of Bio Sanjiveeni (liquid Arka Microbial Consortium), to spray on the crop or run through drip. Adds nitrogen, frees phosphorus and zinc, protects roots against soil-borne fungal and bacterial disease. Safe and organic, non-hazardous to people, livestock and wildlife. Dose: 10 ml per litre, as a foliar spray or through drip fertigation.',
        'Bio Astra: three Streptomyces strains (Arka Actino Consortium) that guard the root zone and grow more roots. They release natural antibiotics around the roots and produce IAA and gibberellins, the plant\'s rooting hormones. Licensed from ICAR-IIHR — Bloom was the first in India to licence it, in 2015. Carrier pouch (5 kg) and liquid formulations. Expiry 6 months from manufacture.',
        'Also available for coffee growers: Bloom Compost Culture (Arka Fermented Cocopeat culture, 5–10 kg in 1 MT of FYM), Bio Hit (Beauveria bassiana biocontrol) and Jackpot (high-grade potassium humate for root health and soil biology). Bloom also makes Bluderma and Blumonas — for their details and doses, offer a call back from an agronomist.',
      ].join('\n\n'),
    },
    {
      title: 'Bloom Biotech — how to apply and safety',
      content: [
        'Application methods and doses: Soil drench — 1 kg in 40 L of water, applied to the root zone. Compost / FYM — 5–10 kg in 1 MT of FYM. Drip fertigation — 1 kg in 40 L, filtered. Foliar / liquid products — 10 ml per litre.',
        'Safety: never tank-mix Bloom products with fungicides, pesticides or insecticides. They are living organisms, and chemicals kill them. Apply them separately.',
        'Shelf life: carrier packs expire 6 months from manufacture.',
        'Exact schedules depend on the crop, its age and the soil; an agronomist confirms the schedule for each farm.',
      ].join('\n\n'),
    },
    {
      title: 'Bloom Biotech — solutions by crop',
      content: [
        'Crops Bloom serves: coffee, black pepper, pomegranate, floriculture and other crops. Problem areas: disease management, pest management, nematode management, better nutrition, root health, soil biology and composting.',
        'Coffee: Bio Sanjiveeni (soil drench, 1 kg in 40 L of water), Bloom Compost Culture (5–10 kg in 1 MT of FYM), Bio Hit (Beauveria bassiana), Bhu Samruddhi (10 ml per litre as spray or drip), Bio Astra (root health and soil biology) and Jackpot (potassium humate).',
        'Black pepper: Bio Sanjiveeni for root health and nutrition, Bio Astra to guard the root zone and grow more roots, Bhu Samruddhi through drip or as a spray. Field-tested with ICAR-IIHR scientists.',
        'Pomegranate: Bio Sanjiveeni to build soil biology and Bhu Samruddhi as a spray or through drip. Field-tested with ICAR-IIHR scientists.',
      ].join('\n\n'),
    },
  ],

  quickReplies: [
    {
      title: 'Bloom · Contact details',
      content_text: `📞 ${PHONE}\n✉️ ${EMAIL}\n📍 Sy. No. 259/1, Hampapura Bypass Road, Beekanahalli Village, Joythinagar, Chikkamagalur 577102`,
    },
    {
      title: 'Bloom · Dosage guide',
      content_text:
        'Here is how to apply our products 🌱\n• Soil drench: 1 kg in 40 L of water at the root zone\n• Drip: 1 kg in 40 L, filtered\n• Compost / FYM: 5–10 kg in 1 MT of FYM\n• Liquid spray: 10 ml per litre',
    },
    {
      title: 'Bloom · Tank-mix warning',
      content_text:
        'Please do not tank-mix Bloom products with fungicides, pesticides or insecticides — they are living organisms and chemicals kill them. Apply them separately.',
    },
    {
      title: 'Bloom · Ask for crop and acreage',
      content_text:
        'Happy to help with a price! 🙏 Could you tell me which crop you grow and roughly how many acres you want to treat?',
    },
  ],

  aiSystemPrompt: [
    'You are the WhatsApp assistant for Bloom Biotech, an agri-biotech company in Chikkamagaluru (since 2013) that makes licensed microbial inputs with ICAR-IIHR: Bio Sanjiveeni, Bhu Samruddhi and Bio Astra.',
    'Introduce yourself as Bloom Biotech when greeting. Keep replies short, warm and practical — farmers read these on their phones.',
    'Never quote prices: prices depend on crop and acreage. Offer a call back from an agronomist and tell the customer they can type "price" to request a quote.',
    'Remind customers never to tank-mix Bloom products with fungicides, pesticides or insecticides when you talk about application.',
    'Customers can type "hi" for the main menu, "products" for the catalogue and "dealer" for dealership enquiries.',
  ].join(' '),
}
