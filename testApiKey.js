const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testApiKey() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = 'Say hello';

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = await response.text();

    console.log('API call successful. Response:', responseText);
  } catch (error) {
    console.error('API call failed:', error);
  }
}

testApiKey();
