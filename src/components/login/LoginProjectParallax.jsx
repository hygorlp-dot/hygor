import { BRAND } from "../../brand/identity.js";

export default function LoginBrandPanel(){
  return <section className="login-project-visual mrc-login-brand" aria-label="MARCELL Engenharia e construção">
    <img src={BRAND.fullLogoOnDark} alt="MARCELL" width="192" height="178" className="mrc-login-signature"/>
    <p className="mrc-login-statement">Engenharia que dá forma<br/>à confiança.</p>
    <span className="mrc-login-rule" aria-hidden="true"/>
  </section>;
}
