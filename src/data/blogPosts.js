// Blog posts for /blog. Add new posts at the top of the array.
// Content blocks: { type: 'p' | 'h2' | 'pairs' | 'callout' | 'cta', ... }
// Optional on h2: art: 'steno' | 'voice' | 'digital' (small section illustration)
// Optional on p/callout: parts: [{ text }, { text, href }] for inline links.
// CTA: { type: 'cta', headline, text, buttonLabel, trackId, secondaryLabel?, secondaryTo? }
// Tags: use ids from BLOG_TAGS below. Heroes: 'launch' | 'tips' | 'industry' | 'backbone' | 'methods' | 'lark' | 'steno'
// After adding/editing posts, run: npm run sync:seo (updates sitemap + llms.txt).

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
  industry: {
    id: 'industry',
    label: 'Industry',
    className: 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed-dim/30',
  },
}

export const blogPosts = [
  {
    slug: 'what-is-a-stenographer',
    title: 'What Is a Stenographer?',
    excerpt:
      'That small keyboard is not a typewriter. What stenographers do in the room, how a stenotype actually writes, and how the machine got here.',
    date: '2026-08-31',
    dateLabel: 'August 31, 2026',
    dateLabelShort: '8/31/26',
    readMinutes: 6,
    tags: ['industry'],
    hero: 'steno',
    metaDescription:
      'What is a stenographer? That small keyboard is not a typewriter. What they do, how a stenotype writes, and how the machine got here.',
    content: [
      {
        type: 'p',
        text: 'If you have sat in a deposition, you have probably seen it. A small keyboard. Almost no keys. A person who barely looks at it, and somehow every word in the room ends up on a page with their name at the end.',
      },
      {
        type: 'p',
        text: 'Most people call that person a court reporter and leave it there. That is true. If they are using what looks like a mini typewriter, the more specific name is stenographer. The craft is stenography. It is not typing. It is not a tape recorder with extra steps. It is a way of writing speech as fast as people talk, built so the record can keep up with the room.',
      },
      {
        type: 'p',
        text: 'What they do. How the machine works. How that keyboard got here. Here is the plain answer.',
      },

      { type: 'h2', text: 'What stenography is', art: 'steno' },
      {
        type: 'p',
        text: 'Stenography is writing in a shortened system so the writer can stay with spoken language. English spelling is slow. Speech is not. So the writer uses sounds, briefs, and phrases instead of picking out letters one at a time the way you do on a QWERTY keyboard.',
      },
      {
        type: 'p',
        text: 'On a stenotype, that means chords. Several keys go down at once. One stroke can be a sound, a word, or a whole phrase the reporter has trained into muscle memory. Software later expands those strokes into English. The theory behind the strokes takes years. The machine is only the instrument.',
      },
      {
        type: 'p',
        text: 'Look at the keyboard and you will see why this is not typing. There are about two dozen keys. The left hand starts the syllable. The thumbs hit the vowels, which sit lower in the middle: A, O, E, U. The right hand finishes the syllable. S, T, P, and R show up on both sides. Left means the sound at the start of the word. Right means the sound at the end.',
      },
      {
        type: 'p',
        text: 'A lot of English letters do not get their own key. There is no F on the left. To start a word with F, you press T and P together. The reporter is building sounds, not spelling.',
      },
      {
        type: 'p',
        text: 'That is why a simple word can look like a different language on the notes. Fish is not F-I-S-H. In one stroke it is TPEURB. TP is the F. EU is the short I. RB is the SH. Nothing in that stroke looks like the English spelling, and that is the point. The machine is built for how the word sounds, not how the dictionary spells it.',
      },
      {
        type: 'callout',
        text: 'The machine writes sounds. The stenographer writes the record.',
      },

      { type: 'h2', text: 'What stenographers do' },
      {
        type: 'p',
        text: 'A stenographer\'s job is to make a complete, usable record of what was said, who said it, and what happened in the room. Depositions. Hearings. Trials. Arbitrations. Sometimes live captioning for someone who needs the words as they are spoken.',
      },
      {
        type: 'p',
        text: 'That is more than catching words. They mark speakers. They catch exhibit numbers. They hold the line when two lawyers talk at once. They know when a mumbled name has to be locked down before it turns into a guessing game at midnight. Then they turn the take into a transcript someone else will quote, file, and argue from.',
      },
      {
        type: 'p',
        text: 'When they certify those pages, they are saying the record is true. Courts rely on that. Counsel relies on that. The person in the chair is not a recording device. They are the official writer of what happened.',
      },
      { type: 'h2', text: 'How the machine got here' },
      {
        type: 'p',
        text: 'The machine most reporters would recognize today comes from Ward Stone Ireland. In the years around 1910 he developed the Stenotype: a small keyboard you could chord, built around sounds instead of spelling. Machines were in use by 1911. Factory production followed. It did not look like a typewriter on purpose. A typewriter writes letters. This thing writes speech.',
      },
      {
        type: 'p',
        text: 'What changed a lot of minds was speed, in public. In 1914, at a national contest in Atlantic City, young stenotypists took most of the events. After that, schools started teaching the machine. The keyboard layout Ireland settled on is still the one under a working reporter\'s hands.',
      },
      {
        type: 'callout',
        text: 'Same idea as 1911. A keyboard built for speech, not spelling.',
      },

      { type: 'h2', text: 'What the computer changed, and what it did not' },
      {
        type: 'p',
        text: 'For a long time the machine still printed a paper tape. The reporter, or a note reader, translated those strokes into English later. Computer-aided transcription changed the last part of that. Strokes could expand on screen. Realtime became possible: a draft the room could see while people were still talking.',
      },
      {
        type: 'p',
        text: 'That is a big deal for access, for rough drafts, for a lawyer who wants to read back a question before the next one. It is not the same thing as the finished transcript. The dictionary still needs a human. Homophones still look like the right word until someone who was in the room says they are not. A clean realtime feed is a tool. The certified pages are still a person\'s work.',
      },
      {
        type: 'callout',
        text: 'New tools changed the desk. They did not change who is responsible for the record.',
      },

      { type: 'h2', text: 'Why the machine still needs a person' },
      {
        type: 'p',
        text: 'If you only see the modern stenotype, it is easy to treat stenography like a gadget. It is not. It is a writing system with a long apprenticeship. The keyboard is small on purpose. The skill lives in the theory, the speed, and the person who knows what the room actually said.',
      },
      {
        type: 'p',
        text: 'That is why the job is hard to casual-copy. You can buy a machine. You cannot buy the judgment that says which "there" was in the room. Stenographers train for years because the record does not get a second take.',
      },
      {
        type: 'p',
        text: 'Court Reportcard exists because that last stretch, from written take to pages you will stand behind, is where tired eyes lose fights they should win. We do not sit in the room. We do not make the record. We are a second set of eyes on a transcript a reporter already wrote.',
      },
      {
        type: 'p',
        text: 'If you came here to understand the profession, that is the part to keep. Stenography is how some of the most important words in a case get onto paper. The machine writes the strokes. The stenographer stands behind the pages.',
      },
      {
        type: 'cta',
        headline: 'The record still needs a last careful pass.',
        text: 'Court Reportcard is a second set of eyes for court reporters. You upload a transcript you already made. You decide what changes.',
        buttonLabel: 'Try Court Reportcard',
        trackId: 'blog_cta_steno_roots_try',
        secondaryLabel: 'See how it works',
        secondaryTo: '/ourplatform',
      },
    ],
  },
  {
    slug: 'let-a-reporter-know-lark',
    title: 'Let A Reporter Know (LARK): Small Tips That Make the Record Better',
    excerpt:
      'A simple idea: when you learn something useful for court reporters, pass it on. Tips for people who work with reporters, tips for reporters, and one more useful tool at the end.',
    date: '2026-08-23',
    dateLabel: 'August 23, 2026',
    dateLabelShort: '8/23/26',
    readMinutes: 5,
    tags: ['tips'],
    hero: 'lark',
    metaDescription:
      'Practical tips for attorneys, clients, and agencies who work with court reporters, plus tips reporters can share with each other, including keeping your dictionary current.',
    content: [
      {
        type: 'p',
        text: 'Court reporting runs on shared knowledge. Someone shows you a better way to handle a messy spelling. Someone warns you about a firm that loves overlapping objections. Someone shares a good way to remember those hard-to-spell drug names. That is how the craft actually travels: one useful tip at a time.',
      },
      {
        type: 'p',
        text: 'So here is a small idea with a big name: Let A Reporter Know. LARK for short. When you learn something that helps the person making the record, do not keep it to yourself. Pass it on. Tell a colleague. Tell the room. Tell the next reporter who inherits the same client.',
      },
      {
        type: 'p',
        text: 'This post is a starter kit. Two short lists. One for people who work with reporters. One for reporters. Then one more tip from us at the end.',
      },
      {
        type: 'callout',
        text: 'LARK: if it helps the record, share it.',
      },

      { type: 'h2', text: 'For people who work with reporters' },
      {
        type: 'p',
        text: 'Whether you are an attorney, a witness, a judge, or anyone else in the room, you do not need a new process. You just need the reporter to actually know what they need before the job starts moving.',
      },
      {
        type: 'p',
        text: '1. Talk at a normal speed, and enunciate. You do not need to speak like a robot. You do need clear enough speech that the words can be told apart. Mumbled names and swallowed endings are where clean transcripts quietly fall apart.',
      },
      {
        type: 'p',
        text: '2. Make sure the reporter knows unusual spellings and party names early. If the caption has a name that fights English, get it to the reporter before they are guessing from audio alone.',
      },
      {
        type: 'p',
        text: '3. Make sure the reporter knows if you need rough or expedite, and whether you are ordering the transcript at all, before the day, not at the end of it. Late surprises are how good jobs turn into bad nights.',
      },
      {
        type: 'p',
        text: '4. Do not talk over each other if you care about a clean record. The transcript cannot invent two clear sentences out of one pileup. Pause. Finish. Then respond.',
      },
      {
        type: 'p',
        text: '5. Make sure the reporter knows when the room changes. New Zoom link. Exhibit drop. Last-minute witness. If the setup moved, the reporter should know before they are already mid-stream.',
      },
      {
        type: 'callout',
        text: 'You do not have to manage the reporter. Just make sure they know.',
      },

      { type: 'h2', text: 'For reporters' },
      {
        type: 'p',
        text: 'This side of LARK is peer to peer. The tips that save your afternoon often save someone else\'s too.',
      },
      {
        type: 'p',
        text: '1. Keep your dictionary up to date. Old entries, half-built jobs, and forgotten brief forms quietly create work for future you. A current dictionary is not busywork. It is how you stop paying for the same correction twice.',
      },
      {
        type: 'p',
        text: '2. When you catch a weird homophone or a job-specific name, pass it along. Text a friend. Drop it in the group chat. Future-you will also thank past-you.',
      },
      {
        type: 'p',
        text: '3. Build a short end-of-job checklist so tired eyes are not your only quality check. Spellings. Numbers. Exhibit references. The three places you personally always miss when you are cooked.',
      },
      {
        type: 'p',
        text: '4. Protect the basics. Water. Breaks. Do not proof at midnight if you can help it. Exhausted proofreading is how clean jobs get one ugly error on page 47.',
      },
      {
        type: 'p',
        text: '5. Share one CAT or workflow trick that saved you real time. No gatekeeping. If a macro, a layout, or a stupid-simple habit cut an hour off your week, Let A Reporter Know.',
      },

      { type: 'h2', text: 'One more LARK' },
      {
        type: 'p',
        text: 'Here is ours. If you proof long transcripts alone, let a reporter know there is a second set of eyes built for this work.',
      },
      {
        type: 'p',
        text: 'Court Reportcard is a proofreading tool for court reporters. You upload a transcript you already made. It flags likely slips: homophones, missing words, punctuation, context problems that a plain spellchecker shrugs at. You accept, ignore, or fix. Nothing changes unless you say so.',
      },
      {
        type: 'p',
        text: 'It does not sit in the room. It does not replace you. It helps you catch the things tired eyes miss before the job leaves your desk.',
      },
      {
        type: 'callout',
        text: 'That is the whole movement in one line: useful knowledge should travel. Tools included.',
      },
      {
        type: 'p',
        text: 'If you have a LARK tip of your own, share it. Reply to this post. Tell a colleague. Start with one useful thing and pass it on. That is how movements actually begin: not with a slogan, with a habit.',
      },
      {
        type: 'cta',
        headline: 'Let a reporter know about a second set of eyes.',
        text: 'Court Reportcard flags hard-to-see slips before the transcript leaves your desk. You stay in control of every change.',
        buttonLabel: 'Try Court Reportcard',
        trackId: 'blog_cta_lark_try',
        secondaryLabel: 'See how it works',
        secondaryTo: '/ourplatform',
      },
    ],
  },
  {
    slug: 'stenographer-voice-writer-digital-reporter',
    title: 'Steno, Voice, and Digital: Three Paths to the Same Record',
    excerpt:
      'Stenographer, voice writer, digital reporter. Different tools. Different training. Same job when your name is on the transcript: make the record, then stand behind it.',
    date: '2026-08-13',
    dateLabel: 'August 13, 2026',
    dateLabelShort: '8/13/26',
    readMinutes: 5,
    tags: ['industry'],
    hero: 'methods',
    metaDescription:
      'Stenographer vs voice writer vs digital court reporter: how each captures proceedings, what they share, and why the transcript still depends on a human who owns the record.',
    content: [
      {
        type: 'p',
        text: 'If you hang around law long enough, you will hear one word used for everyone who makes the record: court reporter. Stenographer. Voice writer. Digital reporter. People treat those as the same title. They are not. They are three different ways of doing the work, folded under one familiar label.',
      },
      {
        type: 'p',
        text: 'This is not a ranking. Courts, agencies, and freelancers use all three. What matters is knowing how the work is captured, where the skill lives, and why the person who certifies the pages still matters no matter which path they took.',
      },

      { type: 'h2', text: 'The stenographer', art: 'steno' },
      {
        type: 'p',
        text: 'A stenographer writes on a stenotype machine. Fingers press chords, not single letters. Those chords map to sounds and phrases through a theory the reporter spent years learning. Software expands the strokes into English. Done well, it can keep up with the room in realtime and feed a clean enough draft to edit into a final transcript.',
      },
      {
        type: 'p',
        text: 'The skill is in the machine, the theory, and the judgment under pressure. Homophones, overlapping speakers, and a mumbled exhibit number still land on the reporter. The stenotype is fast. It is not magic. The human still has to know what was said and how it should read on the page.',
      },

      { type: 'h2', text: 'The voice writer', art: 'voice' },
      {
        type: 'p',
        text: 'A voice writer speaks the proceedings into a stenomask or similar quiet microphone. They repeat, paraphrase, and mark what is happening while the room keeps moving. Speech recognition and CAT software turn that spoken input into text the reporter then edits.',
      },
      {
        type: 'p',
        text: 'The skill looks different from steno, but it is just as trained. Voice writers learn how to dictate cleanly, how to tag speakers and events, and how to stay accurate when testimony gets messy. Many also deliver realtime. The path into the chair is different. The duty on the certificate page is not.',
      },

      { type: 'h2', text: 'The digital reporter', art: 'digital' },
      {
        type: 'p',
        text: 'A digital reporter captures the proceeding primarily with multi-channel audio, often while monitoring levels, logging annotations, and making sure the recording is usable. The transcript may be produced later from that recording by the reporter, a team, or a transcription workflow built around the files.',
      },
      {
        type: 'p',
        text: 'This is not "press record and leave." Bad setup, a dead channel, or a missing log note can wreck a job as surely as a mistranslated stroke. The craft sits more in capture, documentation, and turning audio into a faithful transcript than in writing live at steno or voice speed. Where digital reporting is allowed, the person responsible for the record still has to stand behind the pages.',
      },

      { type: 'h2', text: 'What they share' },
      {
        type: 'p',
        text: 'All three can produce a transcript that becomes part of a legal matter. All three face the same hard parts of English: names, numbers, homophones, false starts, and the little words that change meaning when they go missing. All three work under deadlines that do not care which machine sat on the table.',
      },
      {
        type: 'callout',
        text: 'Different tools. Same pressure. Same need for a careful pass before the job leaves the desk.',
      },
      {
        type: 'p',
        text: 'The industry argument about which method "should" win is louder than most working reporters have time for. In practice, jurisdictions set rules. Clients hire who they trust. Reporters pick the path they trained for. The useful question is not which title is purest. It is whether the finished transcript is accurate, readable, and owned by someone who checked it.',
      },

      { type: 'h2', text: 'Where Court Reportcard fits' },
      {
        type: 'p',
        text: 'We do not sit in the room. We do not care whether your draft came from a stenotype, a stenomask, or a carefully monitored recording. You upload a transcript you already made. We flag likely slips. You accept, ignore, or fix. Nothing changes until you say so.',
      },
      {
        type: 'p',
        text: 'That is deliberate. Proofreading help should follow the pages, not pick a side in a methods debate. Steno, voice, and digital reporters all ship work with their name on it. A second set of eyes at the end of a long job helps every one of those paths for the same reason: tired eyes miss things, and the record does not get a mulligan.',
      },
      {
        type: 'callout',
        text: 'Respect the craft. Respect the differences. Hold the same standard on the last page.',
      },
      {
        type: 'cta',
        headline: 'Whatever path made the draft, finish it carefully.',
        text: 'Court Reportcard is a second set of eyes for court reporters. Catch slips before the transcript leaves your desk.',
        buttonLabel: 'Try Court Reportcard',
        trackId: 'blog_cta_methods_try',
        secondaryLabel: 'See how it works',
        secondaryTo: '/ourplatform',
      },
    ],
  },
  {
    slug: 'faster-transcripts-stronger-backbone',
    title: 'Faster Transcripts, Stronger Backbone',
    excerpt:
      'Court reporters keep the legal system moving. When turnaround gets smoother, the effect ripples outward. A short note on friction, traffic jams, and doing our part.',
    date: '2026-08-06',
    dateLabel: 'August 6, 2026',
    dateLabelShort: '8/6/26',
    readMinutes: 4,
    tags: ['industry'],
    hero: 'backbone',
    metaDescription:
      'How faster court transcript turnaround strengthens the legal system. Court reporters are the backbone. Court Reportcard helps remove proofreading friction so the whole process keeps moving.',
    content: [
      {
        type: 'p',
        text: 'You already know who keeps this whole machine honest. It is not the loudest brief. It is not the software demo. It is the reporter in the chair, then at the desk, turning spoken hours into a record people can trust.',
      },
      {
        type: 'p',
        text: 'Court reporters are the backbone. When the backbone is strong, the system stands up straighter. When the backbone is tired, overloaded, or stuck waiting on a last pass that should not take all night, everything downstream feels it.',
      },

      { type: 'h2', text: 'Turnaround is not a vanity metric' },
      {
        type: 'p',
        text: 'A transcript that gets out the door cleaner and sooner does more than clear your queue. Counsel can prepare. Motions move. Hearings do not stall because someone is still waiting on pages. Appeals do not sit in a holding pattern while the record catches up.',
      },
      {
        type: 'p',
        text: 'That is not abstract policy talk. That is a Tuesday. One job delayed becomes a lawyer waiting. A lawyer waiting becomes a client waiting. A client waiting becomes a calendar that will not budge. The system does not announce the backup. It just gets quieter, slower, and more expensive for everyone in it.',
      },

      { type: 'h2', text: 'The traffic jam nobody schedules' },
      {
        type: 'p',
        text: 'Think about a freeway. One car hits the brakes. The next car brakes harder. Three cars later you have a wall of red lights for a reason that already ended half a mile ahead. Nobody meant to create a jam. Friction stacked up.',
      },
      {
        type: 'p',
        text: 'Transcript work has the same shape. A hard proofread at midnight. A second look because a homophone will not leave you alone. A redo because export formatting fought your CAT software. None of that is laziness. It is the cost of caring. But every extra hour of avoidable friction is a brake light in a system that needs people to keep moving.',
      },
      {
        type: 'callout',
        text: 'Keep the work moving. Remove what you can of the pileup. That is how a backbone stays strong.',
      },

      { type: 'h2', text: 'Doing our part' },
      {
        type: 'p',
        text: 'Court Reportcard will not sit in the room for you. It will not certify the record. It will not replace the judgment that has your name on the last page. What it can do is take some of the drag out of the final stretch: the tired-eye pass, the homophone hunt, the second set of eyes when a scopist is booked and the deadline is not.',
      },
      {
        type: 'p',
        text: 'You upload a transcript you already made. We flag likely slips. You accept, ignore, or fix. Nothing changes until you say so. Then you export and keep moving. Faster turnaround here is not about racing past quality. It is about protecting quality without making the whole chain wait behind a jam that did not need to form.',
      },
      {
        type: 'p',
        text: 'If reporters are the backbone, then tools that respect the craft should make that backbone stronger, not thinner. Stronger means you clear the job sooner with work you still trust. Stronger means attorneys and courts get a record when they need it. Stronger means the system has one less place to seize up.',
      },
      {
        type: 'p',
        text: 'We cannot fix every bottleneck in the law. We can do our part on the stretch we know: the pages between "done writing" and "ready to send." That stretch matters more than it gets credit for. Keep it clear, and a lot of other traffic gets to move.',
      },
      {
        type: 'callout',
        text: 'Your work holds the line. We are here to help you hold it with less friction.',
      },
      {
        type: 'cta',
        headline: 'Keep the record moving.',
        text: 'Court Reportcard is a second set of eyes for court reporters. Catch slips sooner. Ship work you still own.',
        buttonLabel: 'Try Court Reportcard',
        trackId: 'blog_cta_backbone_try',
        secondaryLabel: 'See how it works',
        secondaryTo: '/ourplatform',
      },
    ],
  },
  {
    slug: 'tools-can-help-court-reporters-but-the-last-pass-is-always-yours',
    title: 'Tools Can Help Court Reporters, but the Last Pass Is Always Yours',
    excerpt:
      'An Indiana appeals opinion got loud about transcript quality. Skip the scare headline. The useful part is simple: help is fine. Skipping the proofread is not.',
    date: '2026-07-30',
    dateLabel: 'July 30, 2026',
    dateLabelShort: '7/30/26',
    readMinutes: 3,
    tags: ['industry'],
    hero: 'industry',
    metaDescription:
      'Court transcript proofreading for court reporters: what a recent Indiana appeals opinion means for tools, ownership, and catching mistakes before a job leaves your desk.',
    content: [
      {
        type: 'p',
        text: 'Long day. Tight deadline. You have already read the page twice. Something still feels off. Every reporter knows that feeling. It is not paranoia. It is the job.',
      },
      {
        type: 'p',
        text: 'Last week an Indiana Court of Appeals panel put that pressure on paper. In Williams v. State, Judge Paul Felix, joined by Chief Judge Tavitas and Judge Bradford, called a trial transcript "far from the best." Not because judges expect perfection. They said trial records rarely are. This one still had problems that changed meaning: typos in testimony and objections, names wrong, speakers mixed up so a motion, an objection, and closing argument got credited to the wrong voice in the room.',
      },
      {
        type: 'p',
        parts: [
          { text: 'Eugene Volokh covered the opinion at Reason: ' },
          {
            text: 'Court Notes Apparent AI-Generated Errors in Court Reporter\'s Transcript',
            href: 'https://reason.com/volokh/2026/07/25/court-notes-apparent-ai-generated-errors-in-court-reporters-transcript/',
          },
          { text: '.' },
        ],
      },
      {
        type: 'p',
        text: 'We are not here to pile on that reporter. Most of us have stared at a finished job with that knot in the stomach. What the court said next is the part worth keeping:',
      },
      {
        type: 'callout',
        text: '"[W]e remind the Court Reporter that this court relies on transcripts being true and accurate representations of the transcribed proceedings."',
      },
      {
        type: 'p',
        text: 'That is Indiana Appellate Rule 28(B) in plain English. You certify it. The court trusts it. Same duty it has always been.',
      },

      { type: 'h2', text: 'Do not let the headline steal the point' },
      {
        type: 'p',
        text: 'Some coverage is already turning this into a scare story about technology. You know that story. Machines will take the room. The reporter becomes optional. Budget committees start shopping for cheaper pipelines.',
      },
      {
        type: 'p',
        text: 'Read the opinion itself and the useful line is quieter. The court said tools can improve efficiency. Then it said the part that protects you: if a system helps prepare the transcript, you still have to proofread it before it becomes the record.',
      },
      {
        type: 'callout',
        text: 'The court did not ban the tools. Help is fine. Skipping the proofread is not.',
      },
      {
        type: 'p',
        text: 'That is how you fight back. Not by pretending the future will wait, and not by filing unchecked pages that hand critics exactly what they want. Use the tool that catches tired-hour mistakes. Keep the judgment that still has your name on it.',
      },
      {
        type: 'p',
        text: 'One more distinction matters. The risk the court flagged was unchecked preparation making it into the official record. Court Reportcard is not that kind of tool. We do not write the transcript for you. We do not sit in the room. You bring a finished job. We help you catch what a long day tried to hide.',
      },

      { type: 'h2', text: 'What to do on the next hard job' },
      {
        type: 'p',
        text: 'Before you certify, one more look with fresh eyes: wrong speaker labels, names, homophones, missing little words. The stuff that looks fine when you are close to the job and ugly when an appellate clerk is hunting cites.',
      },
      {
        type: 'p',
        text: 'That last pass is why we built this. Upload the transcript you already made. We flag likely slips. You accept, ignore, or rewrite. Nothing changes until you say so. Then you export work that still meets your standard.',
      },
      {
        type: 'callout',
        text: 'Catch more before it leaves the desk. Keep the final say. That is the whole job.',
      },
      {
        type: 'cta',
        headline: 'Bring a hard transcript. Keep the final say.',
        text: 'Court Reportcard is a second set of eyes for court reporters. Catch slips before the job leaves your desk.',
        buttonLabel: 'Try Court Reportcard',
        trackId: 'blog_cta_industry_try',
        secondaryLabel: 'See how it works',
        secondaryTo: '/ourplatform',
      },
    ],
  },
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
      {
        type: 'cta',
        headline: 'Ready when you are.',
        text: 'Create an account, grab tokens, and put a real transcript through Court Reportcard.',
        buttonLabel: 'Get started',
        trackId: 'blog_cta_launch_try',
        secondaryLabel: 'See pricing',
        secondaryTo: '/pricing',
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
      {
        type: 'cta',
        headline: 'Want a second set of eyes on those pairs?',
        text: 'Court Reportcard flags homophones and other tired-hour slips before the transcript leaves your desk. You decide what changes.',
        buttonLabel: 'Try Court Reportcard',
        trackId: 'blog_cta_homophones_try',
        secondaryLabel: 'See the platform',
        secondaryTo: '/ourplatform',
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
