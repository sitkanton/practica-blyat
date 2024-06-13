const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const app = express();
const port = 3000;


const keywords = {
	animal: [
		"https://4lapy.ru/",
		"https://www.bethowen.ru/",
	],
	wiki: [
		"https://ru.wikipedia.org/wiki/Заглавная_страница",
		"https://ru.wikipedia.org/wiki/Википедия:Форум",
	],
};

app.use(express.json());

app.use(cors());


app.post("/get-urls", (req, res) => {
	const keyword = req.body.keyword;
	const urls = keywords[keyword] || [];
	res.json({ urls });
});

const server = app.listen(port, () => {
	console.log(`Server is running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
	console.log("Client connected");

	ws.on("message", async (message) => {
		const { url } = JSON.parse(message);
		const totalLength = (await axios.head(url)).headers["content-length"];

		axios({
			method: "get",
			url: url,
			responseType: "stream",
		})
			.then((response) => {
				let downloadedLength = 0;
				let dataBuffer = [];
				response.data.on("data", (chunk) => {
					downloadedLength += chunk.length;
					dataBuffer.push(chunk);
					const progress = Math.round(
						(downloadedLength / totalLength) * 100
					);
					ws.send(
						JSON.stringify({
							progress,
							downloadedLength,
							totalLength,
						})
					);
				});

				response.data.on("end", () => {
					const content = Buffer.concat(dataBuffer).toString();

					ws.send(
						JSON.stringify({
							progress: 100,
							downloadedLength,
							totalLength,
							content,
						})
					);
					ws.close();
				});
			})
			.catch((error) => {
				ws.send(
					JSON.stringify({ error: "Failed to download content" })
				);
				ws.close();
			});
	});

	ws.on("close", () => {
		console.log("Client disconnected");
	});
});
