import { useState } from "react";

interface GroceryItem {
  id: number;
  name: string;
  checked: boolean;
}

function App() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [input, setInput] = useState("");

  const addItem = () => {
    const name = input.trim();
    if (!name) return;
    setItems((prev) => [...prev, { id: Date.now(), name, checked: false }]);
    setInput("");
  };

  const toggleItem = (id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Basket
          <span className="ml-2 text-lg font-normal text-gray-400">
            grocery list
          </span>
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addItem();
          }}
          className="mb-8 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add an item..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-5 py-2 font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Add
          </button>
        </form>

        {items.length === 0 ? (
          <p className="text-center text-gray-400">
            Your grocery list is empty. Add some items above.
          </p>
        ) : (
          <div className="space-y-6">
            {uncheckedItems.length > 0 && (
              <ul className="space-y-2">
                {uncheckedItems.map((item) => (
                  <GroceryRow
                    key={item.id}
                    item={item}
                    onToggle={toggleItem}
                    onRemove={removeItem}
                  />
                ))}
              </ul>
            )}

            {checkedItems.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium text-gray-400 uppercase tracking-wide">
                  Checked off ({checkedItems.length})
                </h2>
                <ul className="space-y-2">
                  {checkedItems.map((item) => (
                    <GroceryRow
                      key={item.id}
                      item={item}
                      onToggle={toggleItem}
                      onRemove={removeItem}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GroceryRow({
  item,
  onToggle,
  onRemove,
}: {
  item: GroceryItem;
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
        className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
      />
      <span
        className={`flex-1 ${item.checked ? "text-gray-400 line-through" : "text-gray-900"}`}
      >
        {item.name}
      </span>
      <button
        onClick={() => onRemove(item.id)}
        className="text-gray-300 hover:text-red-500"
        aria-label={`Remove ${item.name}`}
      >
        &times;
      </button>
    </li>
  );
}

export default App;
