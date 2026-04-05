const courtReporterFacts = [
  {
    category: 'History',
    fact: 'Ancient Rome started it all. The world\'s first shorthand system was developed in 63 BC.',
  },
  {
    category: 'History',
    fact: 'Marcus Tullius Tiro, a slave to the Roman philosopher Cicero, invented "Tironian notes" to capture his master\'s speeches.',
  },
  {
    category: 'History',
    fact: 'Shorthand writers were in the room when the Declaration of Independence was drafted.',
  },
  {
    category: 'History',
    fact: 'President Abraham Lincoln entrusted a scribe to record the Emancipation Proclamation.',
  },
  {
    category: 'History',
    fact: 'The ampersand (&) is one of the earliest examples of shorthand, combining the letters of "et" (Latin for "and").',
  },
  {
    category: 'History',
    fact: 'Miles Bartholomew patented the first American shorthand machine in 1879, which recorded dots and dashes on a ribbon.',
  },
  {
    category: 'History',
    fact: 'Ward Stone Ireland invented the modern-style steno machine in 1906, with the reduced keyboard layout still used today.',
  },
  {
    category: 'History',
    fact: 'Old steno machines spit out a continuous ribbon of paper with printed shorthand. Modern machines are entirely digital with LCD screens.',
  },
  {
    category: 'History',
    fact: 'Before machines, Gregg Shorthand (invented in 1888) was the standard pen-and-paper method used by secretaries everywhere.',
  },
  {
    category: 'History',
    fact: 'A monk named John of Tilbury created the first shorthand system specifically for the English language in 1180.',
  },
  {
    category: 'History',
    fact: 'The famous 17th-century diary of Samuel Pepys was written entirely in Thomas Shelton\'s shorthand system.',
  },
  {
    category: 'History',
    fact: 'Stenographers played a crucial role in capturing the verbatim records of the Nuremberg Trials during WWII.',
  },
  {
    category: 'History',
    fact: 'The commission investigating JFK\'s assassination specifically requested "live" verbatim reporters over tape recorders due to the high stakes.',
  },
  {
    category: 'History',
    fact: 'Before Computer-Aided Transcription (CAT), court reporters had to manually translate their paper tape into English — a process that took hours or days.',
  },
  {
    category: 'History',
    fact: 'Early mechanical steno machines required court reporters to manually dip the typing ribbons in ink!',
  },
  {
    category: 'History',
    fact: 'The term "stenography" comes from the Greek words stenos (narrow) and graphein (to write).',
  },
  {
    category: 'History',
    fact: 'The folded paper stack that fed into old steno machines is called a "steno pad" or "steno fold."',
  },
  {
    category: 'History',
    fact: 'Veteran court reporters can read raw steno notes on paper as fluently as reading a regular book.',
  },
  {
    category: 'History',
    fact: 'Until the late 20th century, shorthand was taught in almost every American high school.',
  },
  {
    category: 'History',
    fact: '"Amanuensis" is the old-fashioned term for someone who writes down dictation — an early court reporter.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: '"Voice writers" use a stenomask — a special mask to repeat everything said in the room without being heard by the jury.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'Voice writers can capture upwards of 250 words per minute using specialized speech-to-text software.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: '"Digital reporters" use advanced multi-channel audio equipment and software to capture proceedings instead of steno machines.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'Digital reporters actively monitor audio feeds and take detailed, time-stamped annotations for the transcriptionist.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'The AAERT offers specialized certifications like the Certified Electronic Reporter (CER) for digital court reporters.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'The closed captioning you see on live television — news, sports, daytime TV — is typed by stenographers in real-time.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'Court reporters provide CART (Communication Access Realtime Translation) for deaf or hard-of-hearing students in universities.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'The live captions during the Super Bowl halftime show and live sports announcements are done by real-time captioners.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'Many broadcast captioners work entirely from home, captioning live TV for networks across the country.',
  },
  {
    category: 'Beyond the Steno Machine',
    fact: 'A specialized subset of court reporters transcribes the fast-paced proceedings of the United Nations.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Before becoming a famous novelist, Charles Dickens was a court reporter at age 16.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Actress Michelle Pfeiffer went to court reporting school before her Hollywood career took off.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Actor Harvey Keitel also studied court reporting for a brief time before turning to the screen.',
  },
  {
    category: 'Fun Trivia',
    fact: 'AI has a notoriously hard time filtering out heavy accents, mumbling, and overlapping arguments — things court reporters navigate effortlessly.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Court reporting has a projected job growth of 9%, much faster than average, due to a nationwide shortage of reporters.',
  },
  {
    category: 'Fun Trivia',
    fact: 'When an attorney asks "Can you read that back?", the court reporter can instantly scroll up and read exactly what was just said.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Court Reporting and Captioning Week is celebrated annually every February to raise awareness of the profession.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Just like martial arts styles, there are different "theories" of shorthand — Magnum Steno, StenEd, and Phoenix — that students can learn.',
  },
  {
    category: 'Fun Trivia',
    fact: 'The National Court Reporters Association (NCRA) hosts annual conventions featuring high-stakes speed typing contests.',
  },
  {
    category: 'Fun Trivia',
    fact: 'In some jurisdictions, court reporters legally own the copyright to the transcripts they produce.',
  },
  {
    category: 'Fun Trivia',
    fact: 'In transcripts, attorneys are typically labeled in all caps (e.g., MR. SMITH), while the judge is designated as THE COURT.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Freelance court reporters might take a deposition in a luxury corporate boardroom one day and a state penitentiary the next.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Some highly specialized stenographers learn multiple shorthand theories to provide bilingual reporting.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Earlier shorthand systems used geometric shapes instead of cursive loops to represent sounds.',
  },
  {
    category: 'Fun Trivia',
    fact: 'In some corporate depositions, attorneys request a "clean" transcript — meaning filler words like "um" and "uh" are edited out.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Before modern software, court reporters would dictate their shorthand notes into a Dictaphone for a typist to type out later.',
  },
  {
    category: 'Fun Trivia',
    fact: 'The mere presence of a court reporter often makes people behave better and argue less in a deposition room.',
  },
  {
    category: 'Fun Trivia',
    fact: 'The average age of a court reporter is over 50, meaning a huge wave of retirements is creating massive opportunities for new students.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Court reporters literally write history as it happens, capturing landmark Supreme Court arguments and presidential speeches.',
  },
  {
    category: 'Fun Trivia',
    fact: 'Despite massive advances in technology, the human element — context, accents, interruptions, and the ability to legally swear in a witness — makes court reporters indispensable to the justice system.',
  },
]

export default courtReporterFacts
