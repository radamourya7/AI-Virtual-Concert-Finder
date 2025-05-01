# Virtual Concert Finder Chatbot

An AI-powered chatbot that helps users discover music concerts happening across America. The chatbot personalizes the experience by asking for the user's name and providing tailored concert recommendations.

## Features

- Personalized conversation with name recognition
- US concert search by genre, location, and date
- Integration with Ticketmaster API for real-time concert data
- Intelligent follow-up questions based on user's music preferences
- Fallback to sample data when API is unavailable
- Mobile-friendly responsive design

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- APIs: Ticketmaster API, Geolocation API

## How to Run Locally

1. Make sure you have Node.js installed
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and go to `http://localhost:3000`

## Deployment

### GitHub Pages (Static Frontend Only)

Since GitHub Pages only supports static content, you can deploy the frontend portion of this chatbot:

1. Fork or clone this repository
2. Adjust script.js to work without a backend (already configured for fallback mode)
3. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Select your main branch as the source
   - Save the changes
4. Your chatbot will be available at `https://[your-username].github.io/virtual-concert-chatbot/`

### Full Deployment (with Backend)

For a complete deployment with the Express backend, consider these platforms:
- Heroku
- Vercel
- Netlify (with serverless functions)
- AWS Elastic Beanstalk
- Google Cloud Run

## API Keys

The application uses the Ticketmaster API. The key is already included in the code for demonstration purposes.

## License

MIT 