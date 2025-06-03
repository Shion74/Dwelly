# Dwelly - Student Housing Listing Website

Dwelly is a full-stack web application that helps students and staff find rental accommodations near their university. Users can browse, post, and manage rental listings with features like favorites, ratings, and reporting.

## Features

- User authentication (Student/Staff)
- Property listing management
- Image upload support
- Favorites system
- Rating system
- Report/Flag system
- Admin dashboard
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- XAMPP (for MySQL)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dwelly
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
- Start XAMPP and ensure MySQL is running
- Open phpMyAdmin (http://localhost/phpmyadmin)
- Create a new database named `dwelly_db`
- Import the SQL file from `database/dwelly_db.sql`

4. Configure environment variables:
- Copy `.env.example` to `.env`
- Update the database credentials and other settings in `.env`

5. Create required directories:
```bash
mkdir -p public/uploads
```

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Access the application:
- Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
dwelly/
├── config/
│   └── database.js
├── controllers/
├── models/
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── uploads/
├── routes/
│   ├── admin.js
│   ├── auth.js
│   ├── listings.js
│   └── users.js
├── views/
│   ├── admin/
│   ├── auth/
│   ├── listings/
│   ├── users/
│   └── partials/
├── .env
├── app.js
└── package.json
```

## API Routes

### Authentication
- POST /auth/register - Register a new user
- POST /auth/login - User login
- GET /auth/logout - User logout

### Listings
- GET /listings - View all listings
- GET /listings/create - Create new listing form
- POST /listings/create - Create new listing
- GET /listings/:id - View single listing
- POST /listings/:id/favorite - Add to favorites
- DELETE /listings/:id/favorite - Remove from favorites
- POST /listings/:id/rate - Rate a listing
- POST /listings/:id/report - Report a listing

### User Profile
- GET /users/profile - View profile
- POST /users/profile - Update profile
- GET /users/listings - View user's listings
- GET /users/favorites - View user's favorites
- GET /users/ratings - View user's ratings

### Admin
- GET /admin - Admin dashboard
- POST /admin/listings/:id/flag - Flag a listing
- POST /admin/users/:id/unblock - Unblock a user
- GET /admin/reports/:id - View report details

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the ISC License. 