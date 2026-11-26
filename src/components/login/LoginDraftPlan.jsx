// Planta baixa de uma residência com cotas, portas, janelas e carimbo.
export default function DraftPlan() {
  const wall = (x1, y1, x2, y2) => <line x1={x1} y1={y1} x2={x2} y2={y2} className="mrc-draft-wall"/>;
  const dim = (x1, x2, y, label) => <g className="mrc-draft-dim">
    <line x1={x1} y1={y} x2={x2} y2={y}/>
    <line x1={x1} y1={y - 6} x2={x1} y2={y + 6}/>
    <line x1={x2} y1={y - 6} x2={x2} y2={y + 6}/>
    <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle">{label}</text>
  </g>;
  const room = (x, y, name, area) => <g className="mrc-draft-label">
    <text x={x} y={y} textAnchor="middle">{name}</text>
    <text x={x} y={y + 18} textAnchor="middle" className="mrc-draft-label__area">{area}</text>
  </g>;
  return <svg className="mrc-draft-plan" viewBox="0 0 900 640" width="900" height="640" focusable="false">
    <rect x="40" y="40" width="820" height="500" className="mrc-draft-wall mrc-draft-wall--outer"/>
    <rect x="52" y="52" width="796" height="476" className="mrc-draft-wall"/>
    {wall(420, 52, 420, 200)}{wall(432, 52, 432, 200)}
    {wall(420, 280, 420, 330)}{wall(432, 280, 432, 330)}
    {wall(52, 330, 300, 330)}{wall(52, 342, 300, 342)}
    {wall(380, 330, 848, 330)}{wall(380, 342, 848, 342)}
    {wall(640, 342, 640, 528)}{wall(652, 342, 652, 528)}
    {wall(500, 342, 500, 440)}{wall(512, 342, 512, 440)}
    <g className="mrc-draft-door">
      <line x1="420" y1="200" x2="350" y2="200"/><path d="M350 200 A70 70 0 0 1 420 270"/>
      <line x1="300" y1="336" x2="300" y2="406"/><path d="M300 406 A70 70 0 0 0 370 336"/>
      <line x1="652" y1="460" x2="712" y2="460"/><path d="M712 460 A60 60 0 0 1 652 520"/>
    </g>
    <g className="mrc-draft-window">
      <line x1="120" y1="40" x2="300" y2="40"/><line x1="120" y1="46" x2="300" y2="46"/><line x1="120" y1="52" x2="300" y2="52"/>
      <line x1="560" y1="40" x2="740" y2="40"/><line x1="560" y1="46" x2="740" y2="46"/><line x1="560" y1="52" x2="740" y2="52"/>
      <line x1="40" y1="400" x2="40" y2="480"/><line x1="46" y1="400" x2="46" y2="480"/><line x1="52" y1="400" x2="52" y2="480"/>
    </g>
    {dim(40, 420, 22, "8,20")}{dim(420, 860, 22, "9,00")}
    <g className="mrc-draft-dim">
      <line x1="20" y1="40" x2="20" y2="540"/><line x1="14" y1="40" x2="26" y2="40"/><line x1="14" y1="540" x2="26" y2="540"/>
      <text x="14" y="290" textAnchor="middle" transform="rotate(-90 14 290)">10,00</text>
    </g>
    {room(236, 182, "SALA DE ESTAR", "A = 28,40 m²")}
    {room(640, 182, "COZINHA", "A = 21,60 m²")}
    {room(176, 440, "QUARTO", "A = 14,20 m²")}
    {room(576, 400, "BANHO", "A = 4,80 m²")}
    {room(752, 430, "SUÍTE", "A = 16,90 m²")}
    <g className="mrc-draft-north">
      <circle cx="808" cy="98" r="22"/><path d="M808 72 L816 104 L808 98 L800 104 Z"/>
      <text x="808" y="66" textAnchor="middle">N</text>
    </g>
    <g className="mrc-draft-stamp">
      <rect x="560" y="556" width="300" height="70"/>
      <line x1="560" y1="580" x2="860" y2="580"/><line x1="760" y1="580" x2="760" y2="626"/>
      <text x="572" y="573">MARCELL · ENGENHARIA E CONSTRUÇÃO</text>
      <text x="572" y="600">PLANTA BAIXA · TÉRREO</text>
      <text x="572" y="617" className="mrc-draft-stamp__small">ESCALA 1:50</text>
      <text x="772" y="600">FOLHA</text>
      <text x="772" y="617" className="mrc-draft-stamp__small">01 / 04</text>
    </g>
  </svg>;
}
