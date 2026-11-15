import {useHelpTopic} from '../help/HelpContext.jsx';
import {HelpButton} from '../help/HelpButton.jsx';
export default function FinancialColumnsHelp(){
 useHelpTopic('fin','fin_colunas',2);
 return <HelpButton pageId="fin_colunas" allowedTabs={['fin']} label="Ajuda das colunas"/>;
}
