import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { showHome } from './ui/home';

registerSW({ immediate: true });
showHome();
