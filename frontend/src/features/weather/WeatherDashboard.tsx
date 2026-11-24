
import { useState } from "react";

const forecast = [
  { day: "Today", icon: "☀️", condition: "Sunny", min: "22°C", max: "30°C", rain: "10%" },
  { day: "Thursday", icon: "🌤️", condition: "Partly Cloudy", min: "23°C", max: "29°C", rain: "20%" },
  { day: "Friday", icon: "🌧️", condition: "Rainy", min: "21°C", max: "27°C", rain: "70%" },
  { day: "Saturday", icon: "⛅", condition: "Cloudy", min: "22°C", max: "28°C", rain: "30%" },
  { day: "Sunday", icon: "☀️", condition: "Sunny", min: "23°C", max: "31°C", rain: "5%" },
];

const advisories = [
  {
    icon: "💧",
    title: "Water Management",
    category: "Irrigation",
    description: "Check soil moisture before scheduling irrigation. This is a general demo reminder.",
  },
  {
    icon: "🌱",
    title: "Crop Monitoring",
    category: "Crop Health",
    description: "Inspect crops regularly for visible signs of pests or disease.",
  },
  {
    icon: "🌦️",
    title: "Weather Planning",
    category: "Planning",
    description: "Review local weather forecasts before planning outdoor farm activities.",
  },
];

function WeatherDashboard() {
  const [selectedFarm, setSelectedFarm] = useState("Farm 1");

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h1>AGRI-VOICE</h1>
          <p>Smart Farming Weather & Crop Advisory</p>
        </div>
        <span className="demo-tag">DEVELOPMENT DEMO DATA</span>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">WEATHER DASHBOARD</p>
          <h2>Welcome, Farmer!</h2>
          <p>Monitor weather and plan your farming activities.</p>
        </div>

        <div className="farm-select">
          <label htmlFor="farm">Selected Farm</label>
          <br />
          <select
            id="farm"
            value={selectedFarm}
            onChange={(event) => setSelectedFarm(event.target.value)}
          >
            <option>Farm 1</option>
            <option>Farm 2</option>
            <option>Farm 3</option>
          </select>
        </div>
      </section>

      <section className="weather-card">
        <div>
          <p>CURRENT WEATHER - DEMO VALUES</p>
          <h2>28°C</h2>
          <h3>Partly Cloudy</h3>
          <p>{selectedFarm} - Sample Location</p>
        </div>

        <div className="weather-details">
          <div>
            <small>HUMIDITY</small>
            <strong>65%</strong>
          </div>
          <div>
            <small>RAINFALL</small>
            <strong>10 mm</strong>
          </div>
          <div>
            <small>WIND</small>
            <strong>12 km/h</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>5-Day Weather Forecast</h2>
        <div className="forecast-grid">
          {forecast.map((item) => (
            <article className="forecast-item" key={item.day}>
              <strong>{item.day}</strong>
              <span className="forecast-icon">{item.icon}</span>
              <strong>{item.condition}</strong>
              <span>{item.min} / {item.max}</span>
              <small>Rain chance: {item.rain}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Crop Advisory</h2>
        <p>General demonstration reminders, not verified crop-specific advice.</p>
        <div className="advisory-grid">
          {advisories.map((item) => (
            <article className="advisory-card" key={item.title}>
              <span>{item.icon}</span>
              <small>{item.category}</small>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Weather Alerts</h2>
        <div className="alert-card">
          <span>ℹ️</span>
          <div>
            <strong>No live alerts available</strong>
            <p>
              This development demo does not receive verified weather alerts.
              Connect a working backend to display real alerts.
            </p>
          </div>
        </div>
      </section>

      <footer>
        AGRI-VOICE | Weather & Crop Advisory Dashboard
        <br />
        Development Preview - Sample values only - Not live weather data
      </footer>
    </main>
  );
}

export default WeatherDashboard;
