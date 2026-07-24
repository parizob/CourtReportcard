// Blog posts for /blog. Add new posts at the top of the array.
// Content blocks: { type: 'p' | 'h2' | 'pairs' | 'callout', ... }
// Tags: use ids from BLOG_TAGS below.

export const BLOG_TAGS = {
  'product-update': {
    id: 'product-update',
    label: 'Product Update',
    shortLabel: 'Update',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  tips: {
    id: 'tips',
    label: 'Tips',
    className: 'bg-secondary-container text-on-secondary-container border-secondary/20',
  },
}

export const blogPosts = [
  {
    slug: 'court-reportcard-out-of-beta',
    title: 'We Turned the Lights On',
    excerpt:
      'Court Reportcard is out of beta. Token purchases are live. A small note on why we built this for court reporters, and why that still matters.',
    date: '2026-07-25',
    dateLabel: 'July 25, 2026',
    dateLabelShort: '7/25/26',
    readMinutes: 5,
    tags: ['product-update'],
    hero: 'launch',
    metaDescription:
      'Court Reportcard is out of beta and accepting payments. A proofreading tool built for court reporters: small, dedicated, and designed to help you use technology on your terms.',
    content: [
      {
        type: 'p',
        text: 'Quiet announcement time. No industry-disruption speech. Just this: Court Reportcard is out of beta, and you can buy tokens now.',
      },
      {
        type: 'p',
        text: 'That sentence took longer to earn than it takes to read. For a while this was a free testing ground, a place to see if a second set of eyes built specifically for this craft would actually help on real jobs. Enough of you tried it, pushed it, and told us the truth when something was off. That was the work. Today we are naming what it is: a real product, for real use, with a simple way to keep going when you need more pages.',
      },

      { type: 'h2', text: 'A tool that is just for you' },
      {
        type: 'p',
        text: 'Court reporting does not need another giant platform that treats you like a line item. It needs something small enough to move with you. Something that understands a transcript is not "content." It is a record. Your name is on it. Your reputation rides with every page that leaves your desk.',
      },
      {
        type: 'p',
        text: 'That is what we built. Not a transcription replacement. Not a black box that pretends to be you. A proofreading assistant dedicated to court reporters, scopists, and proofreaders. Nimble on purpose. Ready to grow with the people who actually do this work.',
      },

      { type: 'h2', text: 'A different answer to an old story' },
      {
        type: 'p',
        text: 'For years the industry has been told a version of the same line: when machines can transcribe everything, your job disappears. Big tech says it with a smile. Big legal shops watch the margins. The people in the room with the machine, the deadline, and the certificate page are left to wonder if anyone is building for them at all.',
      },
      {
        type: 'p',
        text: 'Here is our answer, said plainly: technology does not have to be something done to this profession. It can be something you use. A way to catch the tired-hour errors, move cleaner work out the door, and stay in control of quality when the pressure is highest.',
      },
      {
        type: 'p',
        text: 'The naysayers can keep talking about replacement. You can keep shipping accurate transcripts. That is a better argument than any keynote slide.',
      },

      { type: 'h2', text: 'What changes today' },
      {
        type: 'p',
        text: 'You can purchase token packs on the billing page. One token equals one transcript page. No subscription required. If you were with us in beta, thank you. Your early trust is a big part of why this launch is possible.',
      },
      {
        type: 'p',
        text: 'We are still small. That is a feature. Small means we can listen. Small means a support ticket reaches a person. Small means the product can keep getting sharper without needing a corporate roadmap committee to approve a comma.',
      },
      {
        type: 'callout',
        text: 'Built for court reporters. Ready when you are. Your work. Your standards. Your advantage.',
      },
      {
        type: 'p',
        text: 'If you have been waiting for a tool that takes this craft seriously, the door is open. Come take a look. Bring the hard jobs. Tell us what still needs work. We will keep building from there.',
      },

      { type: 'h2', text: 'P.S. You made it this far' },
      {
        type: 'p',
        text: 'Look at you. Still here. Most people bounce after the first "buy tokens" sentence. Not you. You finished the whole thing. That is either dedication or the same stubborn focus that gets a transcript out the door at midnight. We respect both.',
      },
      {
        type: 'p',
        text: 'So here is a tiny launch celebration for the finishers. We made a promo code. Not a scavenger hunt. Not a countdown clock. Just a thank-you for reading past the callout and sticking with us this long.',
      },
      {
        type: 'callout',
        text: 'LAUNCH100. One hundred free tokens. Redeem once on the Billing page. Then put them on a real job and see what you think.',
      },
      {
        type: 'p',
        text: 'Whisper it to Billing. Watch the balance jump. Feel briefly powerful. Then get back to the pages. That is the whole party.',
      },
    ],
  },
  {
    slug: 'common-homophone-errors-in-transcripts',
    title: 'Counsel, Council, and Other Ways to Ruin a Perfectly Good Afternoon',
    excerpt:
      'A short, slightly unhinged guide to the homophones that love to sneak into transcripts when you are tired, hungry, or both.',
    date: '2026-07-22',
    dateLabel: 'July 22, 2026',
    dateLabelShort: '7/22/26',
    readMinutes: 6,
    tags: ['tips'],
    hero: 'tips',
    metaDescription:
      'A witty guide to common homophone errors in court transcripts: counsel vs council, waive vs wave, cite vs site, and more pairs every court reporter should watch for.',
    content: [
      {
        type: 'p',
        text: 'Somewhere right now, a perfectly competent reporter is staring at a page and whispering, "Is it counsel... or council?" Not because they do not know. Because it is 11:47 p.m., the real-time feed looked fine at the time, and English has a personal vendetta against people who type for a living.',
      },
      {
        type: 'p',
        text: 'Homophones are not hard because you are bad at English. They are hard because they sound right, they look almost right, and they wait until you are tired to make their move. This is a little field guide for the ones that show up most in testimony. Keep it nearby. Or tattoo it on your CAT software. We do not judge.',
      },

      { type: 'h2', text: 'The usual suspects' },

      {
        type: 'pairs',
        items: [
          {
            left: 'counsel',
            right: 'council',
            tip: 'Counsel is the lawyer. Council is the group with a meeting agenda and too many opinions. If someone is objecting, it is almost never the city council.',
          },
          {
            left: 'waive',
            right: 'wave',
            tip: 'Waive means give up a right. Wave means hello, goodbye, or "please stop talking with your hands." Nobody waves the Fifth. They waive it. Usually after a long pause.',
          },
          {
            left: 'cite',
            right: 'site / sight',
            tip: 'Cite is the case, rule, or page number. Site is a place. Sight is what you see. "Counsel cited Smith" is legal. "Counsel sighted Smith" sounds like a wildlife documentary.',
          },
          {
            left: 'principal',
            right: 'principle',
            tip: 'Principal is the main person, the school boss, or the money. Principle is the rule you claim to live by until discovery gets interesting.',
          },
          {
            left: 'affect',
            right: 'effect',
            tip: 'Affect is usually the verb (to influence). Effect is usually the noun (the result). There are exceptions. Of course there are. English is a sport.',
          },
          {
            left: 'ensure',
            right: 'insure',
            tip: 'Ensure means make certain. Insure is what you do with a policy and a premium. You ensure the witness appears. You insure the building. Different vibes entirely.',
          },
          {
            left: 'precede',
            right: 'proceed',
            tip: 'Precede means come before. Proceed means go ahead. The judge will proceed. The lunch break will precede your ability to feel human again.',
          },
          {
            left: 'capital',
            right: 'capitol',
            tip: 'Capital is money, uppercase letters, or a city that runs a state. Capitol is the building with the dome. If it has marble steps and a gift shop, it is probably the capitol.',
          },
          {
            left: 'statute',
            right: 'statue',
            tip: 'Statute is the law. Statue is the thing pigeons vote on. If someone is "violating the statue," either you have a typo or a very aggressive art museum.',
          },
          {
            left: 'illicit',
            right: 'elicit',
            tip: 'Illicit means not legal. Elicit means draw out a response. Counsel tries to elicit testimony. Nobody is hoping to illicit testimony. That would be a weird goal.',
          },
          {
            left: 'discreet',
            right: 'discrete',
            tip: 'Discreet means careful and private. Discrete means separate or distinct. A discreet conversation happens quietly. Discrete damages are itemized. One keeps secrets. The other keeps spreadsheets.',
          },
          {
            left: 'complementary',
            right: 'complimentary',
            tip: 'Complementary completes or pairs well. Complimentary is free, or full of praise. Complementary colors. Complimentary parking. If the hotel gave you anything for free, it was complimentary, even if it was not complementary to the room.',
          },
          {
            left: 'stationary',
            right: 'stationery',
            tip: 'Stationary means not moving. Stationery is paper fancy enough to make you feel like you should own a fountain pen. A parked car is stationary. Letterhead is stationery. Confusing these is a classic late-night move.',
          },
          {
            left: 'perspective',
            right: 'prospective',
            tip: 'Perspective is a point of view. Prospective is future or potential. "From my perspective" is opinion. "Prospective juror" is someone who has not escaped yet.',
          },
          {
            left: 'oral',
            right: 'aural',
            tip: 'Oral is spoken. Aural is heard. Most depositions are oral. Your headphones are for aural suffering. If the transcript says "aural argument," check twice unless the topic is literally ears.',
          },
        ],
      },

      { type: 'h2', text: 'The sneaky ones that sound too normal' },
      {
        type: 'p',
        text: 'These are not exotic. That is the problem. They blend in like a quiet juror who is somehow deciding everything.',
      },
      {
        type: 'pairs',
        items: [
          {
            left: 'then',
            right: 'than',
            tip: 'Then is time. Than is comparison. "And then he left." "Better than that." If you can swap in "next," you want then. If you can swap in "compared with," you want than.',
          },
          {
            left: 'your',
            right: "you're",
            tip: 'Your shows ownership. You are becomes you\'re. "Your Honor" is correct. "You\'re Honor" makes the record look like it needs a snack and a nap.',
          },
          {
            left: 'its',
            right: "it's",
            tip: 'Its shows possession. It is becomes it\'s. Courtrooms have its procedures. It\'s Thursday. One has an apostrophe. One does not. Both will gaslight you at 1 a.m.',
          },
          {
            left: 'their / there',
            right: "they're",
            tip: 'Their is ownership. There is a place. They are becomes they\'re. If the sentence works with "they are," use they\'re. If it points to a location, use there. If someone owns it, use their. Congratulations, you have unlocked middle school again.',
          },
        ],
      },

      { type: 'h2', text: 'A two-second check that actually helps' },
      {
        type: 'p',
        text: 'When a word sounds right but feels slightly off, ask one rude little question:',
      },
      {
        type: 'callout',
        text: 'If I swap in the definition out loud, does the sentence still make sense?',
      },
      {
        type: 'p',
        text: '"Counsel for the plaintiff objected." Yes. "Council for the plaintiff objected." Only if local government got very involved in this deposition.',
      },
      {
        type: 'p',
        text: '"They waived notice." Yes. "They waved notice." Charming visual. Wrong record.',
      },

      { type: 'h2', text: 'Why these keep winning' },
      {
        type: 'p',
        text: 'Because speech is fast, steno is faster, and English refuses to behave. Homophones do not announce themselves with a little red flag. They stroll in wearing the same voice as the correct word and sit down like they pay rent.',
      },
      {
        type: 'p',
        text: 'The fix is not panic. The fix is a second look at the pairs you know personally betray you. Everyone has a nemesis. For some people it is counsel/council. For others it is waive/wave. Know yours. Hunt it like it owes you money.',
      },
      {
        type: 'p',
        text: 'And if you catch one before the transcript leaves your desk, that is not pedantry. That is craft. Quiet, unglamorous, deadline-saving craft.',
      },
      {
        type: 'callout',
        text: 'Your reputation is built one clean page at a time. Homophones are just waiting for you to get tired. Do not let them have the last word.',
      },
    ],
  },
]

export function getPostBySlug(slug) {
  return blogPosts.find((post) => post.slug === slug) ?? null
}

export function getTag(tagId) {
  return BLOG_TAGS[tagId] ?? null
}
