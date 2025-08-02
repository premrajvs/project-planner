import React, { useState } from 'react';

// The main App component with a registration form styled using plain CSS.
function App() {
  // Use a state variable to hold the user's email input.
  const [email, setEmail] = useState('');
  // Use a state variable to display messages to the user (e.g., success or error).
  const [message, setMessage] = useState('');
  
  // This function handles the form submission.
  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic validation: check if the email is not empty.
    if (email.trim() === '') {
      setMessage('Please enter a valid email address.');
      return;
    }
    
    // For this step, we'll log the email and show a success message.
    console.log('User submitted email:', email);
    setMessage(`Thank you for registering, ${email}! We will save your data in the next step.`);
    
    // Clear the email input field after submission.
    setEmail('');
  };

  return (
    <div className="container">
      <div className="form-card">
        <h2 className="title">
          Register for the Gantt Chart App
        </h2>
        
        {/* The registration form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="label">
              Email address
            </label>
            <div className="input-container">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="submit-button"
            >
              Register
            </button>
          </div>
        </form>

        {/* Display messages to the user */}
        {message && (
          <div className="message">
            {message}
          </div>
        )}
      </div>

      {/* Styles for our React component */}
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
        }

        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: #f3f4f6;
          padding: 1rem;
        }

        .form-card {
          width: 100%;
          max-width: 448px; /* Equivalent to max-w-md */
          padding: 2rem;
          background-color: #ffffff;
          border-radius: 0.75rem; /* Equivalent to rounded-xl */
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* Equivalent to shadow-lg */
          box-sizing: border-box;
        }

        .title {
          font-size: 1.875rem; /* Equivalent to text-3xl */
          font-weight: 800; /* Equivalent to font-extrabold */
          text-align: center;
          color: #111827; /* Equivalent to text-gray-900 */
          margin-bottom: 1.5rem;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }

        .label {
          display: block;
          font-size: 0.875rem; /* Equivalent to text-sm */
          font-weight: 500; /* Equivalent to font-medium */
          color: #374151; /* Equivalent to text-gray-700 */
          margin-bottom: 0.25rem;
        }

        .input-container {
          margin-top: 0.25rem;
        }

        .input-field {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db; /* Equivalent to border-gray-300 */
          border-radius: 0.375rem; /* Equivalent to rounded-md */
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* Equivalent to shadow-sm */
          font-size: 0.875rem;
          color: #1f2937;
          box-sizing: border-box;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .input-field:focus {
          outline: none;
          border-color: #6366f1; /* Equivalent to focus:border-indigo-500 */
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); /* Equivalent to focus:ring-indigo-500 */
        }

        .submit-button {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0.5rem 1rem;
          border: 1px solid transparent;
          border-radius: 0.375rem; /* Equivalent to rounded-md */
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          font-size: 0.875rem;
          font-weight: 500;
          color: #ffffff;
          background-color: #4f46e5; /* Equivalent to bg-indigo-600 */
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
        }

        .submit-button:hover {
          background-color: #4338ca; /* Equivalent to hover:bg-indigo-700 */
        }

        .submit-button:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
        }

        .message {
          margin-top: 1rem;
          text-align: center;
          font-size: 0.875rem;
          font-weight: 500;
          color: #10b981; /* Equivalent to text-green-600 */
        }
        `}
      </style>
    </div>
  );
}

export default App;
