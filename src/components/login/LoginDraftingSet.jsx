// Instrumentos de desenho técnico da tela de acesso: planta baixa ao fundo,
// esquadro e escalímetro de acrílico, compasso traçando um arco e lapiseira.
// Tudo é decorativo (a cena inteira é aria-hidden) e não usa cor no JSX:
// traço, preenchimento e material vêm das classes .mrc-draft-* em
// themes/marcell.css, que leem os tokens --mrc-login-*.

const range = (n) => Array.from({ length: n }, (_, i) => i);

// Esquadro de 45° em acrílico: o vidro é um div recortado (backdrop-filter só
// funciona em HTML); o SVG por cima desenha arestas, furo e graduação.
export function DraftSetSquare() {
  return <div className="mrc-draft-tool mrc-draft-setsquare">
    <span className="mrc-draft-acrylic mrc-draft-setsquare__glass"/>
    <svg viewBox="0 0 300 300" width="300" height="300" focusable="false">
      <path d="M1 1 L1 299 L299 299 Z M40 110 L40 260 L190 260 Z" className="mrc-draft-edge" fillRule="evenodd"/>
      {range(29).map(i => {
        const y = 289 - i * 10, major = i % 5 === 0;
        return <line key={i} x1="1" y1={y} x2={major ? 16 : 9} y2={y} className="mrc-draft-tick"/>;
      })}
      {range(6).map(i => <text key={i} x="20" y={293 - i * 50} className="mrc-draft-tick-text">{i * 5}</text>)}
      {range(29).map(i => {
        const x = 11 + i * 10, major = i % 5 === 0;
        return <line key={i} x1={x} y1="299" x2={x} y2={major ? 284 : 291} className="mrc-draft-tick"/>;
      })}
    </svg>
  </div>;
}

// Escalímetro triangular: duas faces visíveis com escalas 1:50 e 1:100.
export function DraftScaleRuler() {
  return <div className="mrc-draft-tool mrc-draft-ruler">
    <span className="mrc-draft-acrylic mrc-draft-ruler__glass"/>
    <svg viewBox="0 0 640 64" width="640" height="64" focusable="false">
      <rect x="1" y="1" width="638" height="62" rx="5" className="mrc-draft-edge"/>
      <line x1="1" y1="32" x2="639" y2="32" className="mrc-draft-edge mrc-draft-edge--soft"/>
      {range(101).map(i => {
        const x = 20 + i * 6, major = i % 10 === 0, mid = i % 5 === 0;
        return <line key={`a${i}`} x1={x} y1="1" x2={x} y2={major ? 15 : mid ? 11 : 7} className="mrc-draft-tick"/>;
      })}
      {range(11).map(i => <text key={`ta${i}`} x={20 + i * 60} y="25" textAnchor="middle" className="mrc-draft-tick-text">{i}</text>)}
      {range(51).map(i => {
        const x = 20 + i * 12, major = i % 5 === 0;
        return <line key={`b${i}`} x1={x} y1="63" x2={x} y2={major ? 50 : 56} className="mrc-draft-tick"/>;
      })}
      {range(11).map(i => <text key={`tb${i}`} x={20 + i * 60} y="46" textAnchor="middle" className="mrc-draft-tick-text">{i * 2}</text>)}
      <text x="628" y="25" textAnchor="end" className="mrc-draft-tick-text mrc-draft-tick-text--scale">1:50</text>
      <text x="628" y="46" textAnchor="end" className="mrc-draft-tick-text mrc-draft-tick-text--scale">1:100</text>
    </svg>
  </div>;
}

// Compasso de aço com a ponta seca fixa e a grafite traçando um arco.
export function DraftCompass() {
  return <svg className="mrc-draft-tool mrc-draft-compass" viewBox="0 0 360 380" width="360" height="380" focusable="false">
    <defs>
      <linearGradient id="mrc-draft-steel" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" className="mrc-draft-steel-lo"/>
        <stop offset=".45" className="mrc-draft-steel-hi"/>
        <stop offset="1" className="mrc-draft-steel-mid"/>
      </linearGradient>
    </defs>
    <path d="M244 326 A144 144 0 0 0 36 214" className="mrc-draft-arc"/>
    <circle cx="100" cy="330" r="3" className="mrc-draft-pin"/>
    <rect x="166" y="6" width="16" height="40" rx="4" className="mrc-draft-steel mrc-draft-steel--knurl"/>
    <path d="M160 58 L106 318 L100 330 L98 316 L150 56 Z" className="mrc-draft-steel"/>
    <path d="M188 56 L236 286 L230 290 L178 58 Z" className="mrc-draft-steel"/>
    <rect x="226" y="282" width="16" height="28" rx="3" transform="rotate(-12 234 296)" className="mrc-draft-steel mrc-draft-steel--dark"/>
    <path d="M238 308 L246 328 L234 312 Z" className="mrc-draft-lead"/>
    <line x1="132" y1="196" x2="210" y2="186" className="mrc-draft-screw"/>
    <circle cx="171" cy="191" r="7" className="mrc-draft-steel mrc-draft-steel--dark"/>
    <circle cx="174" cy="58" r="17" className="mrc-draft-steel"/>
    <circle cx="174" cy="58" r="6" className="mrc-draft-steel mrc-draft-steel--dark"/>
  </svg>;
}

// Lapiseira 0,5 mm.
export function DraftPencil() {
  return <svg className="mrc-draft-tool mrc-draft-pencil" viewBox="0 0 380 26" width="380" height="26" focusable="false">
    <rect x="40" y="5" width="300" height="16" rx="3" className="mrc-draft-pencil__body"/>
    <rect x="300" y="3" width="44" height="20" rx="3" className="mrc-draft-steel"/>
    {range(12).map(i => <line key={i} x1={60 + i * 7} y1="6" x2={60 + i * 7} y2="20" className="mrc-draft-pencil__grip"/>)}
    <path d="M40 6 L14 11 L14 15 L40 20 Z" className="mrc-draft-steel"/>
    <line x1="14" y1="13" x2="2" y2="13" className="mrc-draft-pencil__lead"/>
    <rect x="200" y="0" width="96" height="5" rx="2" className="mrc-draft-steel mrc-draft-steel--dark"/>
  </svg>;
}
// Camadas mantidas na ordem da cena de acesso.
export default function LoginDraftingSet() {
  return <>
    <div className="mrc-login-layer mrc-login-layer--mid">
      <DraftSetSquare/>
      <DraftCompass/>
    </div>
    <div className="mrc-login-layer mrc-login-layer--near">
      <DraftScaleRuler/>
      <DraftPencil/>
    </div>
  </>;
}
