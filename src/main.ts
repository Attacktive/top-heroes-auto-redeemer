import { useDiscord } from './discord.js';
import { createServer } from 'http';

const server = createServer((request, response) => {
	if (request.url === '/') {
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.end(JSON.stringify({ status: 'ok', service: 'top-heroes-auto-redeemer' }));
	} else {
		response.writeHead(404);
		response.end('Not Found');
	}
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🏥 Health check server running on port ${PORT}`));

await useDiscord();
