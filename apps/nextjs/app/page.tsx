// @ts-nocheck
export default function Home() {
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      {/* Header */}
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to <span className="text-blue-600">sivel3agent</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          SIVeL 3 Agetn ERC-8004 -a
        </p>
      </header>

      {/* Biblical Verse Highlight */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block bg-white/80 px-4 py-2 rounded-full mb-4 text-sm font-semibold text-blue-700">
            📖 Daily Verse
          </div>
          <blockquote className="text-2xl font-serif italic text-gray-800 mb-4">
            “Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres.”
          </blockquote>
          <p className="text-gray-600 font-medium">
            — Colosenses 3:23 (RVR1960)
          </p>
          <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
            This verse reminds us that our work—including software development—is an offering to God,
            done with excellence and integrity.
          </p>
        </div>
      </section>

      {/* UI Components Showcase */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold border-b pb-2">UI Components Showcase</h2>
        <p className="text-gray-600">
          Below are examples of UI elements built with Tailwind CSS, demonstrating the design system available in this framework.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Buttons */}
          <div className="space-y-4 p-6 border rounded-xl">
            <h3 className="text-xl font-semibold">Buttons</h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Primary
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
                Secondary
              </button>
              <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition">
                Destructive
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                Outline
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="space-y-4 p-6 border rounded-xl">
            <h3 className="text-xl font-semibold">Card</h3>
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
                <h4 className="font-bold text-lg">Project Dashboard</h4>
                <p className="text-blue-100">Overview of your application</p>
              </div>
              <div className="p-4">
                <p className="text-gray-700">
                  This card demonstrates a common layout for dashboard items. Cards are versatile containers for content.
                </p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Updated just now</span>
                  <button className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                    View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-4 p-6 border rounded-xl">
            <h3 className="text-xl font-semibold">Alerts</h3>
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <div className="text-green-600 font-bold mr-2">✓</div>
                  <p className="text-green-800">Success! Your changes have been saved.</p>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <div className="text-yellow-600 font-bold mr-2">⚠</div>
                  <p className="text-yellow-800">Warning: This action cannot be undone.</p>
                </div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <div className="text-red-600 font-bold mr-2">✗</div>
                  <p className="text-red-800">Error: Unable to process your request.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-4 p-6 border rounded-xl">
            <h3 className="text-xl font-semibold">Badges</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                React
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Next.js
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                TypeScript
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                Tailwind
              </span>
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                PostgreSQL
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-4 p-6 border rounded-xl">
            <h3 className="text-xl font-semibold">Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700">Project Completion</span>
                  <span className="font-medium">75%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={ { width: "75%" } }></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700">Testing Coverage</span>
                  <span className="font-medium">90%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={ { width: "90%" } }></div>
                </div>
              </div>
            </div>
          </div>

          {/* Input & Form */}
          <div className="space-y-4 p-6 border rounded-xl">
            <h3 className="text-xl font-semibold">Form Elements</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  rows={3}
                  placeholder="Your message here..."
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="subscribe"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="subscribe" className="ml-2 text-gray-700">
                  Subscribe to updates
                </label>
              </div>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Submit Form
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Project Information */}
      <section className="mt-12 p-8 bg-gray-50 rounded-2xl">
        <h2 className="text-3xl font-bold mb-6">Project Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-white rounded-xl border">
            <div className="text-2xl font-bold text-blue-600">Next.js</div>
            <div className="text-gray-600">15.5.12</div>
          </div>
          <div className="text-center p-4 bg-white rounded-xl border">
            <div className="text-2xl font-bold text-blue-600">React</div>
            <div className="text-gray-600">18.3.1</div>
          </div>
          <div className="text-center p-4 bg-white rounded-xl border">
            <div className="text-2xl font-bold text-blue-600">TypeScript</div>
            <div className="text-gray-600">5.9.3</div>
          </div>
          <div className="text-center p-4 bg-white rounded-xl border">
            <div className="text-2xl font-bold text-blue-600">Tailwind</div>
            <div className="text-gray-600">3.4.19</div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            This project is maintained with diligence and love, following the principle of Colossians 3:23.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Built with the @pasosdejesus/m framework • {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </div>
  );
}