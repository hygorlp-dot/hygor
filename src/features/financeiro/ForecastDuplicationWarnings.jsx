import './forecast-duplication.css';
import {Alert,AlertDescription,AlertTitle} from '../../components/ui/alert.jsx';

export default function ForecastDuplicationWarnings({warnings=[]}){
 if(!warnings.length)return null;
 return <Alert variant="warning" className="forecast-duplication" role="status" aria-label="Possíveis duplicidades de custo">
  <AlertTitle>Confira possíveis duplicidades de custo</AlertTitle>
  <AlertDescription><p>Estes indícios permitem continuar. Os valores permanecem conforme os registros.</p>
   <ul>{warnings.map(w=><li key={w.id}><strong>{w.message}</strong><p>{w.resolution}</p></li>)}</ul>
  </AlertDescription>
 </Alert>;
}
