interface OcrFeedback {
  imageQuality: number;
  tableStructure: boolean;
  nameDetection: boolean;
  markDetection: boolean;
  comments: string;
  timestamp: string;
  imageIncluded: boolean;
  imageData?: string;
}

class FeedbackService {
  /**
   * Send OCR feedback to improve future accuracy
   */
  async sendOcrFeedback(feedback: OcrFeedback, imageData?: string): Promise<boolean> {
    try {
      // In a production environment, you would send this to your backend
      // For now, we'll log it to console
      console.log("OCR Feedback received:", feedback);

      // Store in local storage for development/testing
      const storedFeedback = JSON.parse(localStorage.getItem("ocrFeedback") || "[]");
      const resizedImage = imageData ? await this.resizeImageData(imageData, 100) : undefined;
      storedFeedback.push({
        ...feedback,
        // Only include a small thumbnail of the image to save space
        imageData: resizedImage,
      });
      localStorage.setItem("ocrFeedback", JSON.stringify(storedFeedback));

      return true;
    } catch (error) {
      console.error("Error sending OCR feedback:", error);
      return false;
    }
  }

  /**
   * Resize image data to a smaller size for storage
   */
  private async resizeImageData(imageData: string, maxDimension: number): Promise<string> {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.src = imageData;
    });
  }
}

export default new FeedbackService();
