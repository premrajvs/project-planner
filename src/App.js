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
  const [parentTasks, setParentTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    name: '',
    start: '',
    end: '',
    startTime: '00:00',
    endTime: '00:00',
    parent: '',
    predecessor: ''
  });

  // Effect to handle Firebase initialization and authentication state changes.
  useEffect(() => {
    // 💡 IMPORTANT: These API keys and configuration details are hard-coded for demonstration purposes,
    // which is what caused the GitHub alert. For production, you should use environment variables
    // to keep these details secure and out of your codebase.
    const firebaseConfig = {
      apiKey: "AIzaSyCNPnOMQjIZUcPVXkt2CEpRP0uHwma_Dbg",
      authDomain: "project-planner-19ab6.firebaseapp.com",
      projectId: "project-planner-19ab6",
      storageBucket: "project-planner-19ab6.firebasestorage.app",
      messagingSenderId: "476642475296",
      appId: "1:476642475296:web:c9f48ad77f3f74c71beb45",
      measurementId: "G-9GPQTKTDK7"
    };

    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
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
        setMessage("Failed to initialize Firebase. Please check your configuration.");
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
        const fetchedTasks = {};
        const children = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const task = {
            id: doc.id,
            name: data.name,
            start: new Date(`${data.start}T${data.startTime}:00`),
            end: new Date(`${data.end}T${data.endTime}:00`),
            parent: data.parent || null,
            predecessor: data.predecessor || null
          };
          fetchedTasks[doc.id] = task;
          children.push(task);
        });
        
        // Calculate parent tasks and relationships
        const allTasks = Object.values(fetchedTasks);
        const parentTasksMap = {};
        allTasks.forEach(task => {
          if (task.parent) {
            if (!parentTasksMap[task.parent]) {
              parentTasksMap[task.parent] = { id: task.parent, name: task.parent, children: [] };
            }
            parentTasksMap[task.parent].children.push(task);
          }
        });

        // Calculate parent task start and end dates
        const finalParentTasks = Object.values(parentTasksMap).map(parentTask => {
          const startDates = parentTask.children.map(child => child.start);
          const endDates = parentTask.children.map(child => child.end);
          return {
            id: parentTask.id,
            name: parentTask.name,
            start: new Date(Math.min(...startDates)),
            end: new Date(Math.max(...endDates)),
          };
        });

        setTasks(children);
        setParentTasks(finalParentTasks);
      });
      
      return () => unsubscribe();
    }
  }, [db, userId]);

  // Effect to handle predecessor/successor logic.
  useEffect(() => {
    if (db && userId && tasks.length > 0) {
      // Loop through all tasks to find successors
      tasks.forEach(successorTask => {
        if (successorTask.predecessor) {
          const predecessorTask = tasks.find(t => t.id === successorTask.predecessor);
          if (predecessorTask) {
            const tasksCollectionRef = collection(db, "artifacts", db.app.options.projectId, "users", userId, "tasks");
            const successorTaskDocRef = doc(tasksCollectionRef, successorTask.id);
            
            // Check if the predecessor's end time is later than the successor's start time
            // and adjust if necessary.
            if (predecessorTask.end > successorTask.start) {
              const diff = predecessorTask.end.getTime() - successorTask.start.getTime();
              const newEndDate = new Date(successorTask.end.getTime() + diff);

              // Update the successor task in Firestore.
              updateDoc(successorTaskDocRef, {
                start: predecessorTask.end,
                end: newEndDate,
                // The date fields are stored as strings for simplicity
                start: predecessorTask.end.toISOString().slice(0,10),
                startTime: predecessorTask.end.toTimeString().slice(0,5),
                end: newEndDate.toISOString().slice(0,10),
                endTime: newEndDate.toTimeString().slice(0,5),
              }).catch(error => {
                console.error("Error updating successor task:", error);
              });
            }
          }
        }
      });
    }
  }, [tasks, db, userId]);

  // Effect to draw the Gantt chart whenever tasks or the Google Charts library are ready.
  useEffect(() => {
    if (window.google?.charts && tasks.length > 0) {
      window.google.charts.setOnLoadCallback(drawChart);
    }
  }, [tasks, parentTasks]);

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

    // Add parent tasks first
    parentTasks.forEach(parentTask => {
      const duration = parentTask.end.getTime() - parentTask.start.getTime();
      data.addRow([
        parentTask.id,
        parentTask.name,
        parentTask.start,
        parentTask.end,
        duration,
        0, // Parent tasks are not a single completion
        null
      ]);
    });

    // Add child tasks
    tasks.forEach(task => {
      const duration = task.end.getTime() - task.start.getTime();
      const dependencies = task.predecessor ? task.predecessor : null;
      data.addRow([
        task.id,
        task.name,
        task.start,
        task.end,
        duration,
        100, // Child tasks are considered 100% for this example
        dependencies
      ]);
    });

    const options = {
      height: 400,
      gantt: {
        trackHeight: 30,
        innerGridTrack: { fill: '#fafafa' },
        innerGridHorzLine: { stroke: '#d1d5db' },
        arrow: {
          color: 'red',
          width: 2,
          radius: 0
        },
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
        start: newTask.start,
        end: newTask.end,
        startTime: newTask.startTime,
        endTime: newTask.endTime,
        parent: newTask.parent || null,
        predecessor: newTask.predecessor || null,
        createdAt: new Date()
      });
      setMessage('Task added successfully!');
      setNewTask({ 
        name: '', 
        start: '', 
        end: '', 
        startTime: '00:00', 
        endTime: '00:00',
        parent: '',
        predecessor: ''
      }); // Reset form
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
          <p className="message loading">Loading...</p>
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
            <div id="gantt_chart" className="gantt-chart"></div>
            
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
                type="text"
                placeholder="Parent Task ID (Optional)"
                value={newTask.parent}
                onChange={(e) => setNewTask({ ...newTask, parent: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Predecessor Task ID (Optional)"
                value={newTask.predecessor}
                onChange={(e) => setNewTask({ ...newTask, predecessor: e.target.value })}
                className="input-field"
              />
              <div className="date-time-group">
                <input
                  type="date"
                  value={newTask.start}
                  onChange={(e) => setNewTask({ ...newTask, start: e.target.value })}
                  className="input-field-half"
                  required
                />
                <input
                  type="time"
                  value={newTask.startTime}
                  onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                  className="input-field-half"
                  required
                />
              </div>
              <div className="date-time-group">
                <input
                  type="date"
                  value={newTask.end}
                  onChange={(e) => setNewTask({ ...newTask, end: e.target.value })}
                  className="input-field-half"
                  required
                />
                <input
                  type="time"
                  value={newTask.endTime}
                  onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })}
                  className="input-field-half"
                  required
                />
              </div>
              <button type="submit" className="submit-button">
                Add Task
              </button>
            </form>

            <h3 className="subtitle">Your Tasks</h3>
            <ul className="task-list">
              {tasks.map(task => (
                <li key={task.id} className="task-item">
                  <span className="task-name">{task.name} (ID: {task.id})</span>
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
              className="submit-button logout-button"
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <h2 className="title">
              Register or Log in
            </h2>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="email" className="label">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
              </div>
              <div className="form-group">
                <label htmlFor="password" className="label">Password</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
              </div>
              <div>
                <button type="submit" className="submit-button">Register</button>
              </div>
            </form>
            <div className="divider">
              <div className="divider-line"></div>
              <div className="divider-text">Or continue with</div>
              <div className="divider-line"></div>
            </div>
            <div className="google-sign-in-container">
              <button onClick={handleGoogleSignIn} className="google-sign-in-button">
                <svg className="google-icon" fill="currentColor" viewBox="0 0 48 48"><path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37.9 24 37.9c-7.9 0-14.4-6.4-14.4-14.4S16.1 9.1 24 9.1c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 2.8 29.6 0 24 0 10.7 0 0 10.7 0 24s10.7 24 24 24c12.7 0 21.6-9.1 21.6-23.3 0-1.5-.2-2.9-.5-4.3z"></path></svg>
                Sign in with Google
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        .container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: #f3f4f6;
          padding: 1rem;
          font-family: 'Inter', sans-serif;
        }
        
        .form-card {
          width: 100%;
          padding: 2rem;
          background-color: #ffffff;
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          box-sizing: border-box;
          max-width: 448px;
        }

        @media (min-width: 640px) { /* sm breakpoint */
          .form-card {
            max-width: 512px;
          }
        }

        @media (min-width: 768px) { /* md breakpoint */
          .form-card {
            max-width: 768px;
          }
        }

        @media (min-width: 1024px) { /* lg breakpoint */
          .form-card {
            max-width: 1024px;
          }
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
        
        .gantt-chart {
          width: 100%;
          height: 400px;
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
        
        @media (min-width: 768px) {
          .task-form {
            flex-direction: row;
            flex-wrap: wrap;
          }
        }

        .date-time-group {
          display: flex;
          gap: 0.5rem;
          width: 100%;
        }

        @media (min-width: 768px) {
          .date-time-group {
            width: calc(50% - 0.25rem);
          }
        }
        
        .task-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
          border-top: 1px solid #e5e7eb;
        }

        .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .task-name {
          color: #111827;
        }
        
.delete-button {
  padding: 0.25rem 0.5rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.15s ease-in-out;
}
.delete-button:hover {
  background-color: #dc2626;
}

        .submit-button {
          width: 100%;
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

        .logout-button {
          margin-top: 2rem;
          background-color: #6b7280;
        }
        .logout-button:hover {
          background-color: #4b5563;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.25rem;
        }

        .input-field, .input-field-half {
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
        }

        .input-field-half {
          flex: 1;
        }

        .input-field:focus, .input-field-half:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5);
        }
        
        .divider {
          position: relative;
          margin-top: 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
        }
        
        .divider-line {
          flex-grow: 1;
          border-top: 1px solid #d1d5db;
        }
        
        .divider-text {
          padding: 0 0.5rem;
          font-size: 0.875rem;
          color: #6b7280;
          background-color: white;
          position: relative;
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
        
        .google-icon {
          width: 1.25rem;
          height: 1.25rem;
          margin-right: 0.5rem;
        }
        
        .message {
          margin-top: 1rem;
          text-align: center;
          font-size: 0.875rem;
          font-weight: 500;
        }
        
        .message.success {
          color: #10b981;
        }
        
        .message.error {
          color: #ef4444;
        }
        
        .message.loading {
          color: #10b981;
        }
        `}
      </style>
    </div>
  );
}

export default App;
