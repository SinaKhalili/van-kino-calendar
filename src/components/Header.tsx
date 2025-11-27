import { useMemo } from "react";

const marqueeQuotes = [
  {
    text: "I would travel down to hell and wrestle a film away from the devil if it was necessary.",
    author: "Werner Herzog",
  },
  {
    text: "Cinema is a matter of what's in the frame and what's out.",
    author: "Martin Scorsese",
  },
  {
    text: "Reality is diabolical. We must turn it into poetry.",
    author: "Agnès Varda",
  },
  {
    text: "If it can be written, or thought, it can be filmed.",
    author: "Stanley Kubrick",
  },
  {
    text: "Cinema is the most beautiful fraud in the world.",
    author: "Jean-Luc Godard",
  },
  {
    text: "He who jumps into the void owes no explanation to those who stand and watch.",
    author: "Jean-Luc Godard",
  },
  {
    text: "To be or not to be. That's not really a question.",
    author: "Jean-Luc Godard",
  },
  {
    text: "It's not where you take things from — it's where you take them to.",
    author: "Jean-Luc Godard",
  },
  {
    text: "Why must one talk? Often one shouldn't talk, but live in silence.",
    author: "Jean-Luc Godard",
  },
  {
    text: "A story should have a beginning, a middle and an end, but not necessarily in that order.",
    author: "Jean-Luc Godard",
  },
  {
    text: "To be immortal and then die.",
    author: "Jean-Luc Godard",
  },
  {
    text: "Sometime reality is too complex. Stories give it form.",
    author: "Jean-Luc Godard",
  },
  {
    text: "First there was Greek civilization. Then there was the Renaissance. Now we're entering the Age of the Ass.",
    author: "Jean-Luc Godard",
  },
  {
    text: "A story starts before we encounter it and concludes long after we have turned away.",
    author: "Abbas Kiarostami",
  },
  {
    text: "Most people live only a single life, but an artist lives many.",
    author: "Abbas Kiarostami",
  },
  {
    text: "Film as dream, film as music. No art passes our conscience the way film does, going straight to the soul.",
    author: "Ingmar Bergman",
  },
  {
    text: "Life is a combination of magic and pasta.",
    author: "Federico Fellini",
  },
  {
    text: "All art is autobiographical; the pearl is the oyster's autobiography.",
    author: "Federico Fellini",
  },
  {
    text: "Talking about dreams is like talking about movies; the cinema uses the language of dreams.",
    author: "Federico Fellini",
  },
  {
    text: "The cinema uses the language of dreams; years can pass in a second and you can hop from place to place.",
    author: "Federico Fellini",
  },
  {
    text: "Realism is a bad word. Everything is realistic; there is no line between imaginary and real.",
    author: "Federico Fellini",
  },
  {
    text: "A different language is a different vision of life.",
    author: "Federico Fellini",
  },
  {
    text: "I don't believe in the director's explanations. The older I get, the less I know about the mystery of cinema.",
    author: "Federico Fellini",
  },
  {
    text: "There is no end. There is no beginning. There is only the infinite passion of life.",
    author: "Federico Fellini",
  },
  {
    text: "I feel that I have no limitations as a filmmaker.",
    author: "Federico Fellini",
  },
  {
    text: "I am a storyteller, and I use the cinema to recreate, enlarge, enhance, and distill life in movement.",
    author: "Federico Fellini",
  },
  {
    text: "Your first film is always a once-in-a-lifetime experience. It's an act of love.",
    author: "Federico Fellini",
  },
  {
    text: "Every time I start a film, I think I am making the same film.",
    author: "Federico Fellini",
  },
  {
    text: "Movies you can watch once and understand aren't the ones I like; what you don't get should rest in your heart.",
    author: "Satoshi Kon",
  },
  {
    text: "Filmmaking and dreaming have a lot in common; the dreams we have are unexpected movies.",
    author: "Satoshi Kon",
  },
  {
    text: "Things become confusing when you force something ephemeral to become something concrete.",
    author: "Satoshi Kon",
  },
  {
    text: "Without some kind of mysterious aftertaste, a movie doesn't leave much of an impression.",
    author: "Satoshi Kon",
  },
  {
    text: "Animation audiences understand momentum; live action taught me to appreciate editing.",
    author: "Satoshi Kon",
  },
  {
    text: "I can project my obsession onto the characters and expand the aspects I want to describe.",
    author: "Satoshi Kon",
  },
  {
    text: "As long as animation's unique function is hard to replace, it will be passed down through generations.",
    author: "Satoshi Kon",
  },
  {
    text: "Ideas are like fish. If you want the big ones, you've got to go deeper where they're powerful and beautiful.",
    author: "David Lynch",
  },
  {
    text: "Cinema is a language. It can say big, abstract things, and I love that about it.",
    author: "David Lynch",
  },
  {
    text: "A film should stand on its own with no need for explanation; if it works, it tells you everything.",
    author: "David Lynch",
  },
  {
    text: "I don't know why people expect art to make sense when life doesn't make sense.",
    author: "David Lynch",
  },
  {
    text: "The ideas dictate everything; you have to be true to them or you're dead.",
    author: "David Lynch",
  },
  {
    text: "Negativity is the enemy of creativity.",
    author: "David Lynch",
  },
  {
    text: "To make a film is to create a world.",
    author: "Andrei Tarkovsky",
  },
  {
    text: "Cinema uses your life, not vice versa. You must sacrifice yourself to the art.",
    author: "Andrei Tarkovsky",
  },
  {
    text: "To be an artist means never to avert one's eyes.",
    author: "Akira Kurosawa",
  },
  {
    text: "With a good script, a good director can produce a masterpiece; with a bad script even a good director cannot.",
    author: "Akira Kurosawa",
  },
  {
    text: "A film is never really good unless the camera is an eye in the head of a poet.",
    author: "Orson Welles",
  },
  {
    text: "The enemy of art is the absence of limitations.",
    author: "Orson Welles",
  },
  {
    text: "Create your own visual style... let it be unique for yourself and yet identifiable for others.",
    author: "Orson Welles",
  },
  {
    text: "A writer needs a pen, an artist needs a brush, but a filmmaker needs an army.",
    author: "Orson Welles",
  },
  {
    text: "I believe that the cinema should be dynamic... it is a slice of life in movement projected on a screen.",
    author: "Orson Welles",
  },
  {
    text: "I do not believe in the cinema unless there is movement on the screen... these are dead images otherwise.",
    author: "Orson Welles",
  },
  {
    text: "If you want a happy ending, that depends, of course, on where you stop your story.",
    author: "Orson Welles",
  },
  {
    text: "You have to be a little bit of a poet to be a filmmaker.",
    author: "Werner Herzog",
  },
  {
    text: "The most personal is the most creative.",
    author: "Martin Scorsese",
  },
];

function shuffleQuotes(quotes: typeof marqueeQuotes) {
  const copy = [...quotes];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Header() {
  const marqueeText = useMemo(() => {
    const ordered = shuffleQuotes(marqueeQuotes);
    return ordered
      .map((quote) => `✶ “${quote.text}” — ${quote.author}`)
      .join("     ");
  }, []);

  return (
    <header className="w-full bg-black border-b-8 border-black shadow-[0_8px_0_rgba(0,0,0,0.5)]">
      <h1 className="block w-full border-y-4 border-yellow-200 bg-yellow-200 text-black font-black uppercase tracking-[0.35em] text-sm sm:text-lg py-3 overflow-hidden">
        <div className="overflow-hidden w-full">
          <div className="marquee-track px-4">
            <span className="marquee-segment">{marqueeText}</span>
            <span className="marquee-segment">{marqueeText}</span>
          </div>
        </div>
      </h1>
    </header>
  );
}
