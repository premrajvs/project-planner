/* global __initial_auth_token __firebase_config __app_id */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

// Main application component
function App() {
  // 💡 IMPORTANT: Replace these placeholder values with your actual Firebase project configuration.
  // You can find these details in your Firebase console under Project settings -> General.
  const firebaseConfig = {
    apiKey: "AIzaSyCNPnOMQjIZUcPVXkt2CEpRP0uHwma_Dbg",
    authDomain: "project-planner-19ab6.firebaseapp.com",
    projectId: "project-planner-19ab6",
    storageBucket: "project-planner-19ab6.firebasestorage.app",
    messagingSenderId: "476642475296",
    appId: "1:476642475296:web:c9f48ad77f3f74c71beb45",
    measurementId: "G-9GPQTKTDK7"
  };
  
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
  const [isLoginView, setIsLoginView] = useState(false);
  const [savedCharts, setSavedCharts] = useState([]);
  const [currentChartId, setCurrentChartId] = useState(null);
  const [currentChartName, setCurrentChartName] = useState('');
  const [newChartName, setNewChartName] = useState('');
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Effect to handle Firebase initialization and authentication state changes.
  useEffect(() => {
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
    const projectIdFromEnv = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).projectId : '';

    const appConfig = { ...firebaseConfig };

    // Use environment variables for Firebase config if they are available and the user has not replaced them
    if (projectIdFromEnv && firebaseConfig.projectId === "YOUR_PROJECT_ID") {
      const envConfig = JSON.parse(__firebase_config);
      appConfig.apiKey = envConfig.apiKey;
      appConfig.authDomain = envConfig.authDomain;
      appConfig.projectId = envConfig.projectId;
      appConfig.appId = envConfig.appId;
      // Note: storageBucket and messagingSenderId are not always in __firebase_config
    }
  
    if (appConfig.apiKey && appConfig.projectId) {
      try {
        const app = initializeApp(appConfig);
        const firebaseAuth = getAuth(app);
        const firestoreDb = getFirestore(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
            console.log("Authentication state changed: User is logged in with ID:", user.uid);
          } else {
            setUserId(null);
            console.log("Authentication state changed: No user logged in.");
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken)
                .catch((error) => console.error("Custom token sign-in failed:", error));
            } else {
              await signInAnonymously(firebaseAuth)
                .catch((error) => console.error("Anonymous sign-in failed:", error));
            }
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

  // Effect to load the Google Charts and html2canvas libraries.
  useEffect(() => {
    if (userId) {
      const loadScripts = () => {
        const chartsScript = document.createElement('script');
        chartsScript.src = 'https://www.gstatic.com/charts/loader.js';
        chartsScript.onload = () => {
          window.google.charts.load('current', { 'packages': ['gantt'] });
        };
        document.head.appendChild(chartsScript);

        const html2canvasScript = document.createElement('script');
        html2canvasScript.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
        document.head.appendChild(html2canvasScript);
      };
      
      if (!document.querySelector('script[src*="charts.loader.js"]')) {
        loadScripts();
      }
    }
  }, [userId]);

  // Effect to fetch and listen to saved charts
  useEffect(() => {
    // START OF CHANGES
    if (db && userId) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const chartsCollectionRef = collection(db, "artifacts", appId, "users", userId, "charts");
      
      const unsubscribe = onSnapshot(chartsCollectionRef, async (querySnapshot) => {
        const fetchedCharts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          createdAt: doc.data().createdAt?.toDate() || null,
          modifiedAt: doc.data().modifiedAt?.toDate() || null
        }));
        setSavedCharts(fetchedCharts);
        console.log(`Found ${fetchedCharts.length} saved charts.`);
        
        if (fetchedCharts.length > 0 && !currentChartId) {
          setCurrentChartId(fetchedCharts[0].id);
          setCurrentChartName(fetchedCharts[0].name);
        } else if (querySnapshot.empty) {
          console.log("No charts found for this user. Creating sample chart.");
          
          const newChartDocRef = await addDoc(chartsCollectionRef, {
            name: "Sample Project",
            createdAt: new Date(),
            modifiedAt: new Date(),
          });

          const tasksCollectionRef = collection(newChartDocRef, "tasks");
          
          const sampleTasks = [
            {
              name: "Phase 1: Planning",
              start: '2023-01-01',
              end: '2023-01-05',
              startTime: '09:00',
              endTime: '17:00',
              parent: "Project",
              predecessor: null
            },
            {
              name: "Task A",
              start: '2023-01-06',
              end: '2023-01-10',
              startTime: '09:00',
              endTime: '17:00',
              parent: "Phase 1: Planning",
              predecessor: "Phase 1: Planning"
            },
            {
              name: "Task B",
              start: '2023-01-11',
              end: '2023-01-15',
              startTime: '09:00',
              endTime: '17:00',
              parent: "Phase 1: Planning",
              predecessor: "Task A"
            },
            {
              name: "Phase 2: Execution",
              start: '2023-01-16',
              end: '2023-01-20',
              startTime: '09:00',
              endTime: '17:00',
              parent: "Project",
              predecessor: "Task B"
            }
          ];
      
          for (const task of sampleTasks) {
            await addDoc(tasksCollectionRef, task);
          }
          setMessage("Welcome! A sample chart has been created for you.");
        }
      });
      return () => unsubscribe();
    }
    // END OF CHANGES
  }, [db, userId, currentChartId]);

  // Effect to fetch and listen to tasks from the currently selected chart.
  useEffect(() => {
    if (db && userId && currentChartId) {
      setIsChartLoading(true);
      console.log(`Fetching tasks for chart ID: ${currentChartId} for user ID: ${userId}`);
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const tasksCollectionRef = collection(db, "artifacts", appId, "users", userId, "charts", currentChartId, "tasks");

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

        console.log(`Found ${children.length} tasks in current chart.`);
        
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
        setIsChartLoading(false);
      });

      return () => {
        console.log(`Unsubscribing from Firestore tasks listener for chart ID: ${currentChartId}`);
        unsubscribe();
      };
    } else {
      setTasks([]);
      setIsChartLoading(false);
    }
  }, [db, userId, currentChartId]);

  // Effect to handle predecessor/successor logic.
  useEffect(() => {
    if (db && userId && currentChartId && tasks.length > 0) {
      tasks.forEach(successorTask => {
        if (successorTask.predecessor) {
          const predecessorTask = tasks.find(t => t.name === successorTask.predecessor);
          if (predecessorTask) {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const tasksCollectionRef = collection(db, "artifacts", appId, "users", userId, "charts", currentChartId, "tasks");
            const successorTaskDocRef = doc(tasksCollectionRef, successorTask.id);

            if (predecessorTask.end.getTime() > successorTask.start.getTime()) {
              const diff = predecessorTask.end.getTime() - successorTask.start.getTime();
              const newEndDate = new Date(successorTask.end.getTime() + diff);

              updateDoc(successorTaskDocRef, {
                start: predecessorTask.end.toISOString().slice(0, 10),
                startTime: predecessorTask.end.toTimeString().slice(0, 5),
                end: newEndDate.toISOString().slice(0, 10),
                endTime: newEndDate.toTimeString().slice(0, 5),
              }).catch(error => {
                console.error("Error updating successor task:", error);
              });
            }
          }
        }
      });
    }
  }, [tasks, db, userId, currentChartId]);

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

    parentTasks.forEach(parentTask => {
      const duration = parentTask.end.getTime() - parentTask.start.getTime();
      data.addRow([
        parentTask.name,
        parentTask.name,
        parentTask.start,
        parentTask.end,
        duration,
        0,
        null
      ]);
    });

    tasks.forEach(task => {
      const duration = task.end.getTime() - task.start.getTime();
      const dependencies = task.predecessor ? task.predecessor : null;
      data.addRow([
        task.name,
        task.name,
        task.start,
        task.end,
        duration,
        100,
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
      
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const userDocRef = doc(db, "artifacts", appId, "users", user.uid, "userData", "profile");
      await setDoc(userDocRef, {
        email: user.email,
        createdAt: new Date()
      });

      setMessage(`Registration successful! Welcome, ${user.email}.`);
      setEmail('');
      setPassword('');
      setIsLoginView(true);
    } catch (error) {
      console.error("Registration failed:", error);
      if (error.code === 'auth/email-already-in-use') {
        setMessage('This email is already in use. Please try logging in or use a different email.');
      } else {
        setMessage('Registration failed. Please check your details and try again.');
      }
    }
  };

  // Handle user login with email and password.
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('Login successful!');
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Login failed:", error);
      setMessage('Login failed. Please check your email and password.');
    }
  };

  // Handle Google Sign-in.
  const handleGoogleSignIn = async () => {
    setMessage('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
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
      setSavedCharts([]);
      setCurrentChartId(null);
      setCurrentChartName('');
      setMessage('You have been logged out.');
    } catch (error) {
      console.error("Logout failed:", error);
      setMessage('Logout failed. Please try again.');
    }
  };

  // Handle adding a new task to Firestore.
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.name || !newTask.start || !newTask.end || !currentChartId) {
      setMessage('Please fill out all task fields and select a chart.');
      return;
    }

    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const tasksCollectionRef = collection(db, "artifacts", appId, "users", userId, "charts", currentChartId, "tasks");
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
      const chartDocRef = doc(db, "artifacts", appId, "users", userId, "charts", currentChartId);
      await updateDoc(chartDocRef, { modifiedAt: new Date() });

      setMessage('Task added successfully!');
      setNewTask({
        name: '',
        start: '',
        end: '',
        startTime: '00:00',
        endTime: '00:00',
        parent: '',
        predecessor: ''
      });
    } catch (error) {
      console.error("Error adding task:", error);
      setMessage('Error adding task. Please try again.');
    }
  };

  // Handle deleting a task.
  const handleDeleteTask = async (taskId) => {
    if (!currentChartId) {
      setMessage("Please select a chart to delete a task from.");
      return;
    }
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const taskDocRef = doc(db, "artifacts", appId, "users", userId, "charts", currentChartId, "tasks", taskId);
      await deleteDoc(taskDocRef);
      const chartDocRef = doc(db, "artifacts", appId, "users", userId, "charts", currentChartId);
      await updateDoc(chartDocRef, { modifiedAt: new Date() });
      setMessage('Task deleted successfully!');
    } catch (error) {
      console.error("Error deleting task:", error);
      setMessage('Error deleting task. Please try again.');
    }
  };

  // Function to create a new chart
  const handleCreateNewChart = async () => {
    if (!newChartName) {
      setMessage("Please enter a name for the new chart.");
      return;
    }
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const chartsCollectionRef = collection(db, "artifacts", appId, "users", userId, "charts");
      const newChartDocRef = await addDoc(chartsCollectionRef, {
        name: newChartName,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
      setTasks([]);
      setParentTasks([]);
      setCurrentChartId(newChartDocRef.id);
      setCurrentChartName(newChartName);
      setNewChartName('');
      setMessage(`Chart "${newChartName}" created successfully!`);
    } catch (error) {
      console.error("Error creating new chart:", error);
      setMessage("Failed to create new chart. Please try again.");
    }
  };

  // Function to load a selected chart
  const handleLoadChart = (chartId, chartName) => {
    setTasks([]);
    setParentTasks([]);
    setCurrentChartId(chartId);
    setCurrentChartName(chartName);
    setMessage(`Chart "${chartName}" loaded.`);
  };

  // Function to export the Gantt chart as a PNG image.
  const handleExportImage = () => {
    const chartElement = document.getElementById('gantt_chart');
    if (chartElement && window.html2canvas) {
      window.html2canvas(chartElement).then(canvas => {
        const image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        const link = document.createElement('a');
        link.download = `${currentChartName || 'gantt_chart'}.png`;
        link.href = image;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch(err => {
        console.error("Failed to export chart image:", err);
        setMessage("Failed to export chart image. Please try again.");
      });
    } else {
      setMessage("Gantt chart element or html2canvas library not found.");
    }
  };

  // Function to download tasks as a CSV file.
  const handleDownloadCSV = () => {
    if (tasks.length === 0) {
      setMessage("No tasks to download.");
      return;
    }

    const headers = ["Task Name", "Start Date", "End Date", "Parent Task", "Predecessor Task"];
    const rows = tasks.map(task => [
      `"${task.name.replace(/"/g, '""')}"`,
      task.start.toISOString().slice(0, 10),
      task.end.toISOString().slice(0, 10),
      `"${(task.parent || "").replace(/"/g, '""')}"`,
      `"${(task.predecessor || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${currentChartName || 'gantt_tasks'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
          <div className="main-content">
            <div className="header-container">
                <h2 className="title">{currentChartName || 'Select or Create a Chart'}</h2>
                <button
                    onClick={handleLogout}
                    className="submit-button logout-button"
                >
                    Logout
                </button>
            </div>
            
            <p className="info-message">User ID: {userId}</p>

            <div className="charts-list-container">
                <h3 className="subtitle">Your Charts</h3>
                <ul className="charts-list">
                    {savedCharts.map(chart => (
                        <li key={chart.id} className={`chart-tile-new ${currentChartId === chart.id ? 'active-chart' : ''}`}>
                            <button
                                onClick={() => handleLoadChart(chart.id, chart.name)}
                                className="chart-button-new"
                            >
                                <span className="chart-name-orange">{chart.name}</span>
                                <div className="chart-dates">
                                    {chart.createdAt && (
                                        <span>Created: {chart.createdAt.toLocaleDateString()}</span>
                                    )}
                                    {chart.modifiedAt && (
                                        <span>Modified: {chart.modifiedAt.toLocaleDateString()}</span>
                                    )}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="new-chart-container">
                <input
                    type="text"
                    placeholder="New chart name"
                    value={newChartName}
                    onChange={(e) => setNewChartName(e.target.value)}
                    className="input-field"
                />
                <button onClick={handleCreateNewChart} className="submit-button create-button">
                    Create New Chart
                </button>
            </div>

            {currentChartId && (
                <>
                {isChartLoading ? (
                    <p className="message loading">Loading chart...</p>
                ) : tasks.length > 0 ? (
                    <div id="gantt_chart" className="gantt-chart"></div>
                ) : (
                    <p className="message error">No tasks found. Add a new task to get started.</p>
                )}

                <div className="export-buttons-container">
                    <button
                        onClick={handleExportImage}
                        className="submit-button export-button"
                    >
                        Export Chart as Image
                    </button>
                    <button
                        onClick={handleDownloadCSV}
                        className="submit-button export-button"
                    >
                        Download Tasks as CSV
                    </button>
                </div>
                
                <h3 className="subtitle">Add a New Task to "{currentChartName}"</h3>
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
                        placeholder="Parent Task Name (Optional)"
                        value={newTask.parent}
                        onChange={(e) => setNewTask({ ...newTask, parent: e.target.value })}
                        className="input-field"
                    />
                    <input
                        type="text"
                        placeholder="Predecessor Task Name (Optional)"
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

                <h3 className="subtitle">Tasks in "{currentChartName}"</h3>
                <ul className="task-list">
                    {tasks.map(task => (
                        <li key={task.id} className="task-item">
                            <span className="task-name">{task.name}</span>
                            <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="delete-button"
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
                </>
            )}
          </div>
        ) : (
          <div>
            <div className="toggle-container">
                <button
                    className={`toggle-button ${!isLoginView ? 'active' : ''}`}
                    onClick={() => setIsLoginView(false)}
                >
                    Register
                </button>
                <button
                    className={`toggle-button ${isLoginView ? 'active' : ''}`}
                    onClick={() => setIsLoginView(true)}
                >
                    Login
                </button>
            </div>
            
            {isLoginView ? (
                <div>
                    <h2 className="title">Log in</h2>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="email" className="label">Email address</label>
                            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password" className="label">Password</label>
                            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
                        </div>
                        <div>
                            <button type="submit" className="submit-button">Log in</button>
                        </div>
                    </form>
                </div>
            ) : (
                <div>
                    <h2 className="title">Register</h2>
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
                </div>
            )}
            
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
          <div className={`message ${message.includes('success') || message.includes('Welcome') ? 'success' : 'error'}`}>
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
            max-width: 100%;
          }
        }

        .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .title {
          font-size: 1.875rem;
          font-weight: 800;
          text-align: center;
          color: #111827;
          flex-grow: 1;
        }
        .logout-button {
            margin-left: 1rem;
            width: auto;
            max-width: 120px;
            background-color: #ef4444;
        }
        .logout-button:hover {
            background-color: #dc2626;
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

        .export-buttons-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        @media (min-width: 768px) {
          .export-buttons-container {
            flex-direction: row;
            justify-content: space-around;
          }
        }
        
        .export-button {
          width: 100%;
          background-color: #10b981;
        }
        .export-button:hover {
          background-color: #059669;
        }

        .subtitle {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        
        .charts-list-container {
            margin-top: 1rem;
        }

        .charts-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .chart-tile-new {
            background-color: #f9fafb;
            border-radius: 0.375rem;
            border: 1px solid #d1d5db;
            padding: 0.5rem;
            position: relative;
            cursor: pointer;
            transition: border-color 0.15s ease-in-out;
        }

        .chart-tile-new:hover {
            background-color: #e5e7eb;
            border-color: #4f46e5;
        }

        .chart-tile-new.active-chart {
            border-color: #4f46e5;
            padding-left: 1rem;
        }
        
        .chart-tile-new.active-chart::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 5px;
            background-color: #000;
            border-radius: 0.375rem 0 0 0.375rem;
        }

        .chart-button-new {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
            background: none;
            border: none;
            text-align: left;
            padding: 0;
        }

        .chart-name-orange {
            color: #f97316;
            font-size: 1rem;
            font-weight: 600;
        }
        
        .chart-dates {
            font-size: 0.75rem;
            color: #6b7280;
            display: flex;
            gap: 0.75rem;
        }

        .new-chart-container {
            display: flex;
            gap: 0.5rem;
            margin-top: 1rem;
            align-items: center;
        }
        
        .create-button {
            width: auto;
            flex-shrink: 0;
            margin-left: 1rem;
            max-width: 150px;
            background-color: #ef4444;
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
        
        .toggle-container {
            display: flex;
            width: 100%;
            margin-bottom: 1rem;
            border-radius: 0.375rem;
            overflow: hidden;
            border: 1px solid #d1d5db;
        }
        
        .toggle-button {
            flex-grow: 1;
            padding: 0.5rem;
            background-color: #f9fafb;
            border: none;
            cursor: pointer;
            font-weight: 500;
            color: #4b5563;
            transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
        }
        
        .toggle-button.active {
            background-color: #4f46e5;
            color: white;
        }
        
        .toggle-button:not(.active):hover {
            background-color: #e5e7eb;
        }
        `}
      </style>
    </div>
  );
}

export default App;