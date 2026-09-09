// src/components/ApiModeSwitch.jsx
export default function ApiModeSwitch({ apiMode, setApiMode }) {
  return (
    <div className="flex p-3 gap-4 items-center border-b">
      <label>
        <input
          type="radio"
          checked={apiMode === "default"}
          onChange={() => setApiMode("default")}
        />
        Default API
      </label>

      <label>
        <input
          type="radio"
          checked={apiMode === "user-key"}
          onChange={() => setApiMode("user-key")}
        />
        Use My API Key
      </label>
    </div>
  );
}
