import fs from "fs";
import path from "path";
import { StreamingSource } from "../types/stream.types";
import { PuppeteerActions } from "../services/implementations/puppeteer/PuppeteerActions";
import { DockerCommands } from "../services/implementations/docker/DockerCommands";
import { IProcessedScreenshot } from "../services/interfaces/BrowserService";

export const getLatestScreenshot = async (
  source?: StreamingSource,
): Promise<IProcessedScreenshot> => {
  let screenshot: IProcessedScreenshot = {
    image: "",
    inference: [],
    totalScroll: -1,
    scrollPosition: -1,
    originalImage: "",
  };
  try {
    if (source === "chrome-puppeteer") {
      // For Puppeteer, get screenshot from the active page
      try {
        // Since getScreenshot is private, we'll use a dummy action to get a screenshot
        //infer the screenshot
        screenshot = await PuppeteerActions.captureScreenshot();
      } catch (error) {
        console.log("No active Puppeteer session", error);
      }
    } else if (source === "ubuntu-docker-vnc") {
      // For Docker, get screenshot from the active container
      try {
        const containerName = "factif-vnc";
        const containerStatus =
          await DockerCommands.checkContainerStatus(containerName);
        if (
          containerStatus.exists &&
          containerStatus.running &&
          containerStatus.id
        ) {
          const screenshotPath = `/tmp/screenshot_${Date.now()}.png`;
          const currentScreenshot = await DockerCommands.takeScreenshot(
            containerStatus.id,
            screenshotPath,
          );
          screenshot.image = currentScreenshot;
          screenshot.originalImage = currentScreenshot;
        }
      } catch (error) {
        console.log("No active Docker VNC session", error);
      }
    }
  } catch (error) {
    console.error("Error getting latest screenshot:", error);
  }
  return screenshot;
};

export const saveScreenshot = async (
  screenshot: string,
  folderPath: string,
  chatId: string,
): Promise<string> => {
  try {
    const screenshotDir = path.join(folderPath, chatId || "", "screenshots");

    // Create the directory if it doesn't exist
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const fileName = `screenshot_${Date.now()}.jpg`;
    const filePath = path.join(screenshotDir, fileName);
    // Save the screenshot
    fs.writeFileSync(filePath, Buffer.from(screenshot, "base64"));
    console.log(`Screenshot saved: ${filePath}`);

    // Return the relative path of the saved screenshot
    return path.relative(folderPath, filePath);
  } catch (error) {
    console.log(`Screenshot Save Error`, error);
    return "";
  }
};
