# Building the project

## Project structure :

### Major modules (2 points each) :

- Use a framework for both the frontend and backend.
- Implement real-time features using WebSockets or similar technology.
- Allow users to interact with other users.
- Standard user management and authentication.
- Introduce an AI Opponent for games.
- Implement a complete web-based game where users can play against each other.
- Remote players — Enable two players on separate computers to play the same game in real-time.
- Multiplayer game (more than two players).
- Store tournament scores on the Blockchain.

### Minor modules (1 point each) :

- Use an ORM for the database.
- A complete notification system for all creation, update, and deletion actions.
- Implement a tournament system.

`TOTAL = 21/14 points`

## Module descriptions :

### I. Web :

- Use a framework for both the frontend and backend : 
    - Use a frontend framework (React, Vue, Angular, Svelte, etc.).
    - Use a backend framework (Express, NestJS, Django, Flask, Ruby on Rails, etc.).
    - Full-stack frameworks (Next.js, Nuxt.js, SvelteKit) count as both if you use
    both their frontend and backend capabilities.

- Implement real-time features using WebSockets or similar technology :
    - Real-time updates across clients.
    - Handle connection/disconnection gracefully.
    - Efficient message broadcasting

- Allow users to interact with other users :
    - A basic chat system (send/receive messages between users).
    - A profile system (view user information).
    - A friends system (add/remove friends, see friends list).

- Use an ORM for the database :
    - No additional details

- A complete notification system for all creation, update, and deletion actions :
    - No additional details

### II. User management :

- Standard user management and authentication :
    - Users can update their profile information.
    - Users can upload an avatar (with a default avatar if none provided).
    - Users can add other users as friends and see their online status.
    - Users have a profile page displaying their information.

### III. Artificial Intelligence :

- Introduce an AI Opponent for games :
    - The AI must be challenging and able to win occasionally.
    - The AI should simulate human-like behavior (not perfect play).
    - If you implement game customization options, the AI must be able to use them.
    - You must be able to explain your AI implementation during evaluation.

### IV. Gaming and user experience :

- Implement a complete web-based game where users can play against each other :
    - The game can be real-time multiplayer (e.g., Pong, Chess, Tic-Tac-Toe, Card games, etc.).
    - Players must be able to play live matches.
    - The game must have clear rules and win/loss conditions.
    - The game can be 2D or 3D.

- Remote players — Enable two players on separate computers to play the same game in real-time :
    - Handle network latency and disconnections gracefully.
    - Provide a smooth user experience for remote gameplay.
    - Implement reconnection logic.

- Multiplayer game (more than two players) :
    - Support for three or more players simultaneously.
    - Fair gameplay mechanics for all participants.
    - Proper synchronization across all clients

- Implement a tournament system :
    - Clear matchup order and bracket system.
    - Track who plays against whom.
    - Matchmaking system for tournament participants.
    - Tournament registration and management.

### V. Blockchain :

- Store tournament scores on the Blockchain :
    - Use Avalanche and Solidity smart contracts on a test blockchain.
    - Implement smart contracts to record, manage, and retrieve tournament scores.
    - Ensure data integrity and immutability.

## Task assignment :

#### Jianxin

- Use a framework for the backend (1 point)
- Implement real-time features using WebSockets or similar technology (2 points)
- Remote players — Enable two players on separate computers to play the same game in real-time (2 points)
- Multiplayer game (more than two players) (2 points)

`TOTAL = 7 points`

#### Arthur

- Implement a complete web-based game where users can play against each other (backend part: 1 point)
- Implement a tournament system (1 point)
- Store tournament scores on the Blockchain (2 points)

`TOTAL = 4 points`

#### Igor

- Standard user management and authentication (2 points)
- Use an ORM for the database (1 point)
- Introduce an AI Opponent for games (2 points)

`TOTAL = 5 points`

#### Thomas

- Use a framework for the frontend (1 point)
- Implement a complete web-based game where users can play against each other (frontend part: 1 point)
- Allow users to interact with other users (2 points)
- A complete notification system for all creation, update, and deletion actions (1 point)

`TOTAL = 5 points`

## Role assignment :

#### Jianxin

Technical Lead / Architect: Oversees technical decisions and architecture.

- Defines technical architecture.
- Makes technology stack decisions.
- Ensures code quality and best practices.
- Reviews critical code changes.

#### Arthur

Technical Lead support:  Supports the Technical Lead in architectural and technical decisions.

#### Igor

Product Owner (PO): Defines the product vision, prioritizes features, and ensures the project meets user needs.

- Maintains the product backlog.
- Makes decisions on features and priorities.
- Validates completed work.
- Communicates with stakeholders (evaluators, peers).


#### Thomas

Project Manager (PM) / Scrum Master: Facilitates team coordination and removes obstacles.

- Organizes team meetings and planning sessions.
- Tracks progress and deadlines.
- Ensures team communication.
- Manages risks and blockers.