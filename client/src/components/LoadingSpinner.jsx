import './LoadingSpinner.css';

export default function LoadingSpinner({ text = 'Loading...', size = 'default' }) {
  return (
    <div className={`loading-spinner-wrap ${size}`}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
}
