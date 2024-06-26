import express, { json } from "express";
import puppeteer from "puppeteer";
import JSZip from "jszip";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5000;

// Middleware to handle JSON request bodies
app.use(json());
// Enable CORS
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
);

app.post("/screenshot", async (req, res) => {
  try {
    const { url } = req.body;

    console.log("url received : ", url);

    const browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });
    const page = await browser.newPage();

    const devices = [
      {
        name: "mobile",
        viewport: {
          width: 390,
          height: 844,
          isMobile: true,
          hasTouch: true,
          isLandscape: false,
        },
      },
      {
        name: "tablet",
        viewport: {
          width: 768,
          height: 1024,
          isMobile: true,
          hasTouch: true,
          isLandscape: false,
        },
      },
      {
        name: "desktop",
        viewport: {
          width: 1920,
          height: 1080,
          isMobile: false,
          hasTouch: false,
          isLandscape: true,
        },
      },
    ];

    const screenshots = [];
    console.log("Start");
    for (const device of devices) {
      await page.setViewport(device.viewport);
      await page.goto(url, { waitUntil: "networkidle2" });

      let scrollPosition = 0;
      let pageHeight = await page.evaluate(() => document.body.scrollHeight);

      while (scrollPosition < pageHeight) {
        await page.evaluate(
          (scrollPos) => window.scrollTo(0, scrollPos),
          scrollPosition
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const screenshot = await page.screenshot({ encoding: "base64" });
        screenshots.push({ device: device.name, screenshot });

        scrollPosition += device.viewport.height;
        pageHeight = await page.evaluate(() => document.body.scrollHeight);
      }
    }

    await browser.close();
    console.log("Ended");

    const zip = new JSZip();
    screenshots.forEach((screenshot, index) => {
      const imgData = screenshot.screenshot.replace(
        /^data:image\/png;base64,/,
        ""
      );
      zip.file(`screenshot-${screenshot.device}-${index + 1}.png`, imgData, {
        base64: true,
      });
    });

    const zipBlob = await zip.generateAsync({ type: "nodebuffer" });

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=screenshots.zip",
    });
    console.log("Zipped");

    res.send(zipBlob);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
