import React, { useState } from 'react';
import { getElectronAPI } from '../../utils/electron';
import { cn } from '../../utils/cn';
import Button from '../Button';

interface AddFeedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string, category: string) => Promise<void>;
  availableCategories: string[];
}

const AddFeedDialog: React.FC<AddFeedDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  availableCategories,
}) => {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Default');
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    title?: string;
    error?: string;
  } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const resetForm = () => {
    setUrl('');
    setCategory('Default');
    setCustomCategory('');
    setUseCustomCategory(false);
    setValidationResult(null);
    setIsValidating(false);
    setIsAdding(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateUrl = async () => {
    if (!url.trim()) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await getElectronAPI().feeds.validate(url.trim());
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setValidationResult(null);
  };

  const handleAdd = async () => {
    if (!url.trim() || !validationResult?.valid) return;

    setIsAdding(true);
    try {
      const finalCategory = useCustomCategory && customCategory.trim()
        ? customCategory.trim()
        : category;

      await onAdd(url.trim(), finalCategory);
      handleClose();
    } catch (error) {
      // Error will be handled by the parent component
      console.error('Failed to add feed:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const isUrlValid = url.trim() && (url.startsWith('http://') || url.startsWith('https://'));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add New Podcast
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                RSS Feed URL
              </label>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={validateUrl}
                  disabled={!isUrlValid || isValidating}
                >
                  {isValidating ? 'Checking...' : 'Validate'}
                </Button>
              </div>
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div className={cn(
                "p-3 rounded-md text-sm",
                validationResult.valid
                  ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
              )}>
                {validationResult.valid ? (
                  <div>
                    <div className="font-medium">✓ Valid podcast feed</div>
                    {validationResult.title && (
                      <div className="mt-1">Title: {validationResult.title}</div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">✗ Invalid feed</div>
                    {validationResult.error && (
                      <div className="mt-1">{validationResult.error}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="existing-category"
                    checked={!useCustomCategory}
                    onChange={() => setUseCustomCategory(false)}
                    className="text-blue-600"
                  />
                  <label htmlFor="existing-category" className="text-sm text-gray-700 dark:text-gray-300">
                    Use existing category
                  </label>
                </div>

                {!useCustomCategory && (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="Default">Default</option>
                    {availableCategories.filter(cat => cat !== 'Default').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="custom-category"
                    checked={useCustomCategory}
                    onChange={() => setUseCustomCategory(true)}
                    className="text-blue-600"
                  />
                  <label htmlFor="custom-category" className="text-sm text-gray-700 dark:text-gray-300">
                    Create new category
                  </label>
                </div>

                {useCustomCategory && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAdd}
              disabled={!validationResult?.valid || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add Podcast'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFeedDialog;
