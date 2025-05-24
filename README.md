# Bookkeeping App

This project is a web application designed for managing financial records. It allows users to track income and expenses, categorize transactions, and view financial summaries. Key features include user authentication for secure access, the ability to create, read, update, and delete financial records, and potential data visualization to help users understand their financial health.

## Features

- **User Authentication**: Secure login and registration functionalities powered by NextAuth.js, with support for OAuth providers (e.g., Google) to ensure safe access to your financial data.
- **Transaction Management**:
    - Comprehensive CRUD (Create, Read, Update, Delete) operations for managing income and expense records.
    - Ability to categorize transactions for better financial organization and tracking.
- **Data Visualization**:
    - Interactive charts and graphs (via ECharts) to display financial summaries, such as income vs. expenses, spending habits by category, and financial trends over time.
    - Visual insights to help users understand their financial health at a glance.
- **Responsive Design**: A fully responsive user interface that adapts seamlessly to various screen sizes, ensuring a consistent experience on desktops, tablets, and mobile devices.
- **Dark Mode**: A user-selectable dark mode option for improved visual comfort in low-light environments, built using `next-themes`.

## Getting Started

This section will guide you through setting up the project locally.

### Prerequisites

Make sure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (version 18.x or later recommended)
- npm (comes with Node.js), or alternatively [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), or [bun](https://bun.sh/)

### 1. Clone the Repository

First, clone the project repository to your local machine:
```bash
git clone <repository-url>
cd <repository-name>
```
Replace `<repository-url>` with the actual URL of the repository and `<repository-name>` with the name of the directory created.

### 2. Install Dependencies

Install the project dependencies using your preferred package manager:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 3. Environment Variables

This project requires certain environment variables to be set up for local development. Create a file named `.env.local` in the root of your project and add the following variables:

```env
# Vercel Postgres Database Connection String
POSTGRES_URL="your_postgres_connection_string"

# NextAuth.js secret for signing tokens
AUTH_SECRET="your_random_auth_secret" # Generate a strong random string, e.g., using `openssl rand -hex 32`

# Google OAuth Credentials (if you want to use Google login)
# Obtain these from the Google Cloud Console: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# Application URL for NextAuth.js (especially for OAuth callbacks)
NEXTAUTH_URL="http://localhost:3000" # Or https://localhost:3000 if using HTTPS
```

**How to get the values:**
- `POSTGRES_URL`: You can get this connection string when you create a new Vercel Postgres database. For local development, you might connect to a local PostgreSQL instance or a free tier cloud-hosted one.
- `AUTH_SECRET`: This is a critical security variable. Generate a long, random string.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Follow the NextAuth.js documentation or Google Cloud Console instructions to set up an OAuth 2.0 client.
- `NEXTAUTH_URL`: This should be the base URL of your application. For local development, it's typically `http://localhost:3000`. If you are using `npm run dev --experimental-https` as suggested in `package.json`, this should be `https://localhost:3000`.

### 4. Database Setup

This project uses Vercel Postgres.
- **Schema Management**: The database schema is managed by Vercel based on your application's needs or through direct interaction with the Vercel dashboard.
- **Seeding**: If you have initial data to populate (e.g., default categories, test users), you might need to run seed scripts. (Currently, no specific seed scripts are provided in this boilerplate. You would add them to your `package.json` and run them, for example, with `npm run seed`.)

For local development against a local Postgres instance, you would typically use a tool like `psql` or a GUI client to create your database and tables according to your application's models. However, when deploying to Vercel, Vercel Postgres will be the target.

### 5. Running the Development Server

Once you have set up your environment variables, you can start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

This will typically start the application on `http://localhost:3000` or `https://localhost:3000` if using the `--experimental-https` flag. Open this URL in your browser to see the application.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Tech Stack

This project utilizes the following key technologies and libraries:

- **Framework:** [Next.js](https://nextjs.org/)
- **UI Library:** [React](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/)
- **Database:** [Vercel Postgres](https://vercel.com/storage/postgres)
- **State Management:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/)
- **Charts/Data Visualization:** [ECharts](https://echarts.apache.org/)

## Project Structure

The project follows a structure conventional for Next.js applications using the App Router. Here's a brief overview of the main directories:

-   **`src/app/`**: The heart of the application, containing all routing, pages, API endpoints, and layout components.
    -   **`src/app/api/`**: Contains all server-side API route handlers. This is where your backend logic for data fetching and mutations resides.
    -   **`src/app/auth/`**: Includes pages and components related to user authentication, such as login, registration, and session management.
    -   **`src/app/(routes)/`**: This directory (or similar, based on route groups like `record/` and `records/`) houses the primary application routes like the dashboard, transaction records pages, etc. The parentheses denote a route group, which doesn't affect the URL path.
-   **`src/components/`**: Home to shared UI components used across multiple parts of the application.
    -   **`src/components/ui/`**: Typically contains UI primitives and components, often from libraries like Shadcn/UI, Radix UI, or custom-built base components.
-   **`src/lib/`**: A collection of utility functions, helper scripts, type definitions, and client-side configuration files (e.g., `src/lib/utils.ts`, `src/lib/authOptions.ts`).
-   **`src/styles/`**: Contains global stylesheets, Tailwind CSS configuration (`tailwind.config.js` is usually at the root, but global CSS might be here), and font definitions.
-   **`public/`**: Stores static assets that are served directly, such as images, favicons, and other public files.

## Contributing

We welcome contributions to the Bookkeeping App! Whether you're fixing a bug, adding a new feature, or improving documentation, your help is appreciated.

### Reporting Issues

If you encounter a bug or have a feature suggestion, please report it using [GitHub Issues](<link-to-github-issues>). Provide as much detail as possible, including steps to reproduce the bug or a clear description of the suggested feature.

### Pull Request Process

1.  **Fork the repository**: Start by forking the main repository to your GitHub account.
2.  **Create a branch**: For new features, use `git checkout -b feature/your-feature-name`. For bug fixes, use `git checkout -b bugfix/issue-number`.
3.  **Make your changes**: Implement your feature or bug fix.
4.  **Lint your code**: Ensure your code adheres to the project's linting standards by running:
    ```bash
    npm run lint
    ```
    Please fix any linting errors or warnings before committing.
5.  **Commit your changes**: Write clear, concise, and descriptive commit messages.
6.  **Push your branch**: Push your changes to your forked repository.
7.  **Open a Pull Request**: Create a pull request from your branch to the `main` branch of the original repository. Provide a clear description of the changes in your PR.

### Code Style

This project uses ESLint for code linting and formatting. The rules are defined in the project's ESLint configuration. Please ensure your contributions conform to these rules, as checked by the `npm run lint` command.

### Setting up a Development Environment

For instructions on how to set up your local development environment, please refer to the [Getting Started](#getting-started) section.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deployment

This application is a standard Next.js project and can be deployed to any platform that supports Node.js applications.

### Recommended: Vercel

[Vercel](https://vercel.com/), the creators of Next.js, provide a seamless deployment experience for Next.js applications. The platform automatically handles build optimization, serverless functions, and global CDN distribution.

To deploy to Vercel:
1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Sign up or log in to [Vercel](https://vercel.com/signup).
3.  Import your Git repository. Vercel will typically detect that it's a Next.js project and configure the build settings automatically.
4.  **Environment Variables**: Configure the same environment variables as listed in the `.env.local` example (`POSTGRES_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`) in your Vercel project settings. Ensure `NEXTAUTH_URL` is set to your production domain.
5.  Deploy.

For more detailed information, refer to the [Next.js deployment documentation on Vercel](https://nextjs.org/docs/deployment).

### Other Platforms

You can also deploy this application to other platforms like:
-   AWS (Amplify, EC2, Elastic Beanstalk)
-   Google Cloud (Cloud Run, App Engine)
-   Azure (App Service)
-   Netlify
-   Heroku
-   DigitalOcean App Platform

When deploying to these platforms, you will generally need to:
1.  Ensure your deployment environment has Node.js installed.
2.  Set up the required **environment variables** in your chosen platform's configuration (similar to the Vercel setup).
3.  Use the following build command:
    ```bash
    npm run build
    ```
4.  And then start the application using:
    ```bash
    npm run start
    ```
    The specific commands and configuration for serving a Next.js app might vary slightly depending on the platform. Consult the documentation for your chosen hosting provider.

## License

This project is licensed under the MIT License.

It is recommended to create a `LICENSE` file in the root of the project containing the full text of the MIT License.
