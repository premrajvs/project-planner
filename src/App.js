import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Main application component
function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    name: '',
    start: '',
    end: ''
  });

  // Effect to handle Firebase initialization and authentication state changes.
  useEffect(() => {
    // Paste your Firebase configuration object here.
    // You can get this from the Firebase Console when you set up a new web app.
    const firebaseConfig = {
      apiKey: "AIzaSyCNPnOMQjIZUcPVXkt2CEpRP0uHwma_Dbg",
      authDomain: "project-planner-19ab6.firebaseapp.com",
      projectId: "project-planner-19ab6",
      storageBucket: "project-planner-19ab6.firebasestorage.app",
      messagingSenderId: "476642475296",
      appId: "1:476642475296:web:c9f48ad77f3f74c71beb45",
      measurementId: "G-9GPQTKTDK7"
    };

    const projectId = firebaseConfig.projectId;

    if (firebaseConfig.apiKey && projectId) {
      try {
        const app = initializeApp(firebaseConfig);
        const firebaseAuth = getAuth(app);
        const firestoreDb = getFirestore(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null);
            // Sign in anonymously to ensure a user is always present for Firestore access.
            await signInAnonymously(firebaseAuth)
                .catch((error) => console.error("Anonymous sign-in failed:", error));
          }
          setIsAuthReady(true);
        });
        
      } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        setMessage("Failed to initialize Firebase. Please try again later.");
      }
    } else {
        setMessage("Please add your Firebase configuration to the code.");
    }
  }, []);

  // Effect to load the Google Charts library.
  useEffect(() => {
    if (userId) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/charts/loader.js';
      script.onload = () => {
        window.google.charts.load('current', {'packages':['gantt']});
      };
      document.head.appendChild(script);
    }
  }, [userId]);

  // Effect to fetch and listen to tasks from Firestore.
  useEffect(() => {
    if (db && userId) {
      const tasksCollectionRef = collection(db, "artifacts", db.app.options.projectId, "users", userId, "tasks");
      
      const unsubscribe = onSnapshot(tasksCollectionRef, (querySnapshot) => {
        const fetchedTasks = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedTasks.push({
            id: doc.id,
            name: data.name,
            start: new Date(data.start.toDate()),
            end: new Date(data.end.toDate())
          });
        });
        setTasks(fetchedTasks);
      });
      
      return () => unsubscribe();
    }
  }, [db, userId]);

  // Effect to draw the Gantt chart whenever tasks or the Google Charts library are ready.
  useEffect(() => {
    if (window.google?.charts && tasks.length > 0) {
      window.google.charts.setOnLoadCallback(drawChart);
    }
  }, [tasks]);

  // Function to draw the Gantt chart.
  const drawChart = () => {
    const data = new window.google.visualization.DataTable();
    data.addColumn('string', 'Task ID');
    data.addColumn('string', 'Task Name');
    data.addColumn('date', 'Start Date');
    data.addColumn('date', 'End Date');
    data.addColumn('number', 'Duration');
    data.addColumn('number', 'Percent Complete');
    data.addColumn('string', 'Dependencies');

    tasks.forEach(task => {
      const duration = task.end.getTime() - task.start.getTime();
      data.addRow([
        task.id,
        task.name,
        task.start,
        task.end,
        duration,
        100, // We'll set completion to 100% for simplicity.
        null
      ]);
    });

    const options = {
      height: 400,
      gantt: {
        trackHeight: 30,
      }
    };

    const chart = new window.google.visualization.Gantt(document.getElementById('gantt_chart'));
    chart.draw(data, options);
  };

  // Handle user registration with email and password.
  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!email || !password || password.length < 6) {
      setMessage('Please enter a valid email and a password of at least 6 characters.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userDocRef = doc(db, "artifacts", db.app.options.projectId, "users", user.uid, "userData", "profile");
      await setDoc(userDocRef, {
        email: user.email,
        createdAt: new Date()
      });

      setMessage(`Registration successful! Welcome, ${user.email}.`);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Registration failed:", error);
      if (error.code === 'auth/email-already-in-use') {
        setMessage('This email is already in use. Please try logging in or use a different email.');
      } else {
        setMessage('Registration failed. Please check your details and try again.');
      }
    }
  };

  // Handle Google Sign-in.
  const handleGoogleSignIn = async () => {
    setMessage('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // The onAuthStateChanged listener will handle the rest.
      setMessage('Signed in with Google successfully!');
    } catch (error) {
      console.error("Google Sign-in failed:", error);
      setMessage('Google Sign-in failed. Please try again.');
    }
  };

  // Handle user logout.
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage('You have been logged out.');
      setTasks([]);
    } catch (error) {
      console.error("Logout failed:", error);
      setMessage('Logout failed. Please try again.');
    }
  };

  // Handle adding a new task to Firestore.
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.name || !newTask.start || !newTask.end) {
      // Replaced alert with a message box for better UX
      setMessage('Please fill out all task fields.');
      return;
    }

    try {
      const tasksCollectionRef = collection(db, "artifacts", db.app.options.projectId, "users", userId, "tasks");
      await addDoc(tasksCollectionRef, {
        name: newTask.name,
        start: new Date(newTask.start),
        end: new Date(newTask.end),
        createdAt: new Date()
      });
      setMessage('Task added successfully!');
      setNewTask({ name: '', start: '', end: '' }); // Reset form
    } catch (error) {
      console.error("Error adding task:", error);
      setMessage('Error adding task. Please try again.');
    }
  };

  // Handle deleting a task.
  const handleDeleteTask = async (taskId) => {
    try {
      const taskDocRef = doc(db, "artifacts", db.app.options.projectId, "users", userId, "tasks", taskId);
      await deleteDoc(taskDocRef);
      setMessage('Task deleted successfully!');
    } catch (error) {
      console.error("Error deleting task:", error);
      setMessage('Error deleting task. Please try again.');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="container">
        <div className="form-card">
          <p className="message">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="form-card">
        {userId ? (
          <div>
            <h2 className="title">Gantt Chart for User ID: {userId}</h2>
            <p className="info-message">
              User ID: {userId}
            </p>
            <div id="gantt_chart" style={{ width: '100%', height: '400px' }}></div>
            
            <h3 className="subtitle">Add a New Task</h3>
            <form onSubmit={handleAddTask} className="task-form">
              <input
                type="text"
                placeholder="Task Name"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                className="input-field"
                required
              />
              <input
                type="date"
                value={newTask.start}
                onChange={(e) => setNewTask({ ...newTask, start: e.target.value })}
                className="input-field"
                required
              />
              <input
                type="date"
                value={newTask.end}
                onChange={(e) => setNewTask({ ...newTask, end: e.target.value })}
                className="input-field"
                required
              />
              <button type="submit" className="submit-button">Add Task</button>
            </form>

            <h3 className="subtitle">Your Tasks</h3>
            <ul className="task-list">
              {tasks.map(task => (
                <li key={task.id} className="task-item">
                  <span>{task.name}</span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>

            <button
              onClick={handleLogout}
              className="submit-button"
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <h2 className="title">
              Register for the Gantt Chart App
            </h2>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="email" className="label">Email address</label>
                <div className="input-container">
                  <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="password" className="label">Password</label>
                <div className="input-container">
                  <input id="password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
                </div>
              </div>
              <div>
                <button type="submit" className="submit-button">Register</button>
              </div>
            </form>
            <div className="google-sign-in-container">
              <button onClick={handleGoogleSignIn} className="google-sign-in-button">
                Sign in with Google
              </button>
            </div>
          </div>
        )}

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
          max-width: 448px;
          padding: 2rem;
          background-color: #ffffff;
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          box-sizing: border-box;
        }
        .title {
          font-size: 1.875rem;
          font-weight: 800;
          text-align: center;
          color: #111827;
          margin-bottom: 1.5rem;
        }
        .info-message {
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }
        .form-group {
          margin-bottom: 1.5rem;
        }
        .label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.25rem;
        }
        .input-container {
          margin-top: 0.25rem;
        }
        .input-field {
          display: block;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          font-size: 0.875rem;
          color: #1f2937;
          box-sizing: border-box;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
          margin-bottom: 0.5rem;
        }
        .input-field:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
        }
        .submit-button {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0.5rem 1rem;
          border: 1px solid transparent;
          border-radius: 0.375rem;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          font-size: 0.875rem;
          font-weight: 500;
          color: #ffffff;
          background-color: #4f46e5;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
        }
        .submit-button:hover {
          background-color: #4338ca;
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
          color: #10b981;
        }
        .message.error {
          color: #ef4444;
        }
        .subtitle {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .task-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .task-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .task-item:last-child {
          border-bottom: none;
        }
        .delete-button {
          padding: 0.25rem 0.5rem;
          background-color: #ef4444;
          color: white;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
        }
        .delete-button:hover {
          background-color: #dc2626;
        }
        .google-sign-in-container {
          margin-top: 1rem;
        }
        .google-sign-in-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: #ffffff;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f2937;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
        }
        .google-sign-in-button:hover {
          background-color: #f3f4f6;
        }
        `}
      </style>
    </div>
  );
}

export default App;
