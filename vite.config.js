import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// AI 실시간 햅틱 라이브 브로드캐스트 Vite 플러그인
function aiHapticLivePlugin() {
  return {
    name: 'ai-haptic-live-plugin',
    configureServer(server) {
      server.middlewares.use('/api/live-haptic', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              // Vite WebSocket을 통해 접속된 모든 VR 웹 클라이언트(퀘스트 3)로 실시간 브로드캐스트
              server.ws.send('ai-live-haptic', data);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ status: 'ok', message: 'Quest 3 컨트롤러로 AI 햅틱 실시간 송신 완료!' }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [basicSsl(), aiHapticLivePlugin()],
  server: {
    https: true,
    host: true, // 네트워크 전체 노출 (퀘스트 접속용)
    port: 5174,
  },
});
