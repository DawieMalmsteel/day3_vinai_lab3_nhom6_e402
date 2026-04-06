/**
 * Utility to export data to a JSON file and trigger a browser download.
 * @param data The object or array to export.
 * @param fileName The name of the file to be downloaded.
 */
export const exportToJson = (data: any, fileName: string): void => {
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    // Append to body to make it work in all browsers
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to JSON:', error);
  }
};
