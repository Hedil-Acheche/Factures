const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyCJ7rHiUbTbwsLijhD6dqaTbTe8c06xX08');
async function test() {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent('Hello, world!');
  console.log(await result.response.text());
}
test();