import { chromium } from 'playwright';
import readline from 'node:readline';

const DEBUG_URL = 'http://127.0.0.1:9222';
const INTERVALO = 60000;

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}
process.stdin.resume();
let encerrar = false;
let aguardandoTecla: ((tecla: string) => void) | null = null;
process.stdin.on('keypress', (_, key) => {
    const tecla = key?.name?.toLowerCase();

    if (tecla === 'q' || key?.sequence?.toLowerCase() === 'q') {
        encerrar = true;
        aguardandoTecla?.('q');
    } else if (aguardandoTecla && tecla) {
        aguardandoTecla(tecla);
    }
});
function esperar(ms: number): Promise<void> {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            aguardandoTecla = null;
            resolve();
        }, ms);

        aguardandoTecla = tecla => {
            if (tecla === 'q') {
                clearTimeout(timer);
                aguardandoTecla = null;
                resolve();
            }
        };
    });
}
function perguntar(): Promise<string> {
   console.log('Deseja continuar verificando? (S/N) | Q para sair');
    return new Promise(resolve => {
        const verificar = (tecla: string) => {
            if (tecla === 's' || tecla === 'n' || tecla === 'q') {
                aguardandoTecla = null;
                resolve(tecla);
            }
        };

        aguardandoTecla = verificar;
    });
}
async function main() {
    const browser = await chromium.connectOverCDP(DEBUG_URL);
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().startsWith('https://claude.ai'));

    if (!page) throw new Error('Abra o Claude no Chrome.');

    console.log('Monitoramento iniciado. Pressione Q para sair.');
    while (!encerrar) {
        const botao = page.getByRole('button', {
            name: 'Continuar',
            exact: true
        });
        if (await botao.count() > 0 && await botao.isVisible() && await botao.isEnabled()) {
            await botao.click();
            console.log('Botão Continuar clicado!');
            const resposta = await perguntar();
            if (resposta !== 's') break;
        } else {
            console.log('Botão indisponível. Nova verificação em 1 minuto.');
        }
        if (!encerrar) await esperar(INTERVALO);
    }
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log('Monitoramento encerrado.');
}
main().catch(console.error);