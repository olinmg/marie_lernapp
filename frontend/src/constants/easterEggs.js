export const POSITIVE_QUOTES = [
  "Oh look at you go! That's my girl! 💖",
  "Brains and beauty. You're crushing this! 🔥",
  "Five in a row! You're an absolute genius. 🧠✨",
  "I always knew you were smart. Absolutely killing it! 🥰",
  "Unstoppable! Keep this energy going! 🚀",
  "You make this look so incredibly easy! 💅",
  "On a roll! I am so incredibly proud of you. 🌟",
  "That brain of yours is amazing. Keep it up! 💡",
  "Who's the smartest person I know? You are! 👩‍🎓",
  "Flawless victory! You've got this exam in the bag. 🎒",
  "Look at those neurons firing! I'm so proud. ⚡",
  "You're a machine! A very cute, brilliant machine. 🤖❤️",
  "Is there anything you can't do? Keep crushing it! ✨",
  "Another correct answer! You're making me look bad. 😉",
  "Right again! I'll be prepping the celebration dance. 💃"
];

export const SUPPORTIVE_QUOTES = [
  "Hey, take a deep breath. You've got this! ☕",
  "It’s just a tiny bump in the road. Drink some water and try again! 💧",
  "This exam is tough, but you are tougher. I believe in you. ❤️",
  "Don't stress, my love. You've studied so hard, it will click! 🫂",
  "Last exam before freedom! Take a 5-minute break if you need it. ☀️",
  "Mistakes mean you are learning. Shake it off, you're doing great! ✨",
  "Close your eyes for 10 seconds. Breathe in, breathe out. I love you! 🧘‍♀️",
  "Hey, even Einstein made mistakes. Don't be too hard on yourself! 🫂",
  "Frustration is temporary, but the degree is forever. You can do this! 🎓",
  "If you need to vent, I'm right here. Otherwise, let's try the next one! 💌",
  "This material is hard, but I know how capable you are. Take your time. 🕰️",
  "Don't let a few tricky questions dim your light. You're brilliant! 💖",
  "Roll your shoulders back, unclench your jaw. You're fine, I promise. 💆‍♀️",
  "It's okay to be annoyed, but remember how far you've come! 🌈",
  "A minor setback for a major comeback. Next question, let's go! 🚀"
];

export const INTERMISSION_QUOTES = [
  "25 questions down! Look at that dedication. I am so proud of your hard work. 🎉",
  "Wow, you are working so incredibly hard! You are amazing. Keep the momentum going! 💪",
  "Just a little intermission to remind you of how incredibly proud I am of you. 🌹",
  "You're doing amazing, sweetie. One step closer to being done forever! 🎓",
  "Incredible stamina! Take a screen break for a few seconds. Look away and rest your eyes. 👀",
  "I know how stressful this period is, but you are handling it beautifully. Keep going! ❤️",
  "Every question you answer gets you closer to the finish line. I can't wait to celebrate with you! 🥂",
  "Massive progress! 📈 Every correct or wrong answer is a lesson learned.",
  "Time for a quick stretch! Reach for the sky, you beautiful academic weapon! ⚔️",
  "I am in awe of your work ethic. You are going to be so relieved when this is over. 🌅",
  "25 more steps towards absolute freedom. I'm cheering for you from the sidelines! 📣",
  "Reward yourself with a little sip of something yummy. You've earned this pause! 🥤"
];

export const END_SESSION_QUOTES = [
  "Session complete! Here's a little something to make you smile. 🥰",
  "You worked so hard today. Now go take a well-deserved break! I love you! ❤️",
  "Another study session in the bag. You are going to ace this exam! 💯",
  "I am so proud of the effort you put in today. You deserve the world! 🌍",
  "Done for now! Go stretch, eat something nice, and know that I'm so proud of you. 🍕",
  "You put in the work today. The finish line is so close I can almost see it! 🏁",
  "Rest that brilliant brain of yours. You've done enough for this session. 🛏️",
  "Every session counts, and today was a great one. Sending you the biggest hug! 🤗",
  "You did it! One study session down, one step closer to our celebration dinner! 🍝",
  "I admire your dedication so much. Now close the app and relax. You've earned it! 🛀"
];

export function getRandomQuote(quotesArray) {
  return quotesArray[Math.floor(Math.random() * quotesArray.length)];
}
