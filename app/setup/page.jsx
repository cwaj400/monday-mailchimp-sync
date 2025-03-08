'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Setup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    monday: {
      apiKey: '',
      boardId: ''
    },
    mailchimp: {
      apiKey: '',
      audienceId: '',
      serverPrefix: ''
    },
    discord: {
      webhookUrl: ''
    }
  });
  
  const handleChange = (section, field, value) => {
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: value
      }
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        alert('Configuration saved successfully!');
        router.push('/dashboard');
      } else {
        const data = await response.json();
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert(`Error saving configuration: ${error.message}`);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Integration Setup</h1>
      
      <div className="mb-8 flex justify-between">
        {[1, 2, 3, 4].map((stepNumber) => (
          <div 
            key={stepNumber}
            className={`flex items-center ${step >= stepNumber ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-2 ${
              step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {stepNumber}
            </div>
            <span className="font-medium">
              {stepNumber === 1 && 'Monday.com'}
              {stepNumber === 2 && 'Mailchimp'}
              {stepNumber === 3 && 'Field Mapping'}
              {stepNumber === 4 && 'Notifications'}
            </span>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Connect to Monday.com</h2>
            <p className="mb-4">Enter your Monday.com API key and board ID:</p>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="monday-api-key">
                Monday.com API Key:
              </label>
              <input
                type="password"
                id="monday-api-key"
                className="w-full p-2 border rounded"
                value={config.monday.apiKey}
                onChange={(e) => handleChange('monday', 'apiKey', e.target.value)}
                placeholder="Enter your Monday.com API key"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="monday-board-id">
                Board ID:
              </label>
              <input
                type="text"
                id="monday-board-id"
                className="w-full p-2 border rounded"
                value={config.monday.boardId}
                onChange={(e) => handleChange('monday', 'boardId', e.target.value)}
                placeholder="Enter your Monday.com board ID"
                required
              />
            </div>
            
            <button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </div>
        )}
        
        {/* Similar sections for steps 2-4 */}
        
        {step === 4 && (
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => setStep(3)}
            >
              Previous
            </button>
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Save Configuration
            </button>
          </div>
        )}
      </form>
    </div>
  );
} 