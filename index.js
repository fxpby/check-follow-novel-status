const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const tagList = process.env.TAG_LIST;
  const gotoURL = process.env.GO_TO_URL;
  const entryHTMLElementString = process.env.ENTRY_HTML_ELEMENT_STRING;
  const titleHTMLElementString = process.env.TITLE_HTML_ELEMENT_STRING;
  const nodemailerConfigUser = process.env.CONFIG_AUTH_USER;
  const nodemailerConfigPass = process.env.CONFIG_AUTH_PASS;
  const sendMailTo = process.env.SEND_MAIL_TO;
  const sendMailFrom = process.env.SEND_MAIL_FROM;
  const emailSubject = process.env.EMAIL_SUBJECT;

  try {
    await page.goto(gotoURL);
    const entryElement = await page.$(entryHTMLElementString);
    if (entryElement) {
      entryElement.click();
      await new Promise((r) => setTimeout(r, 5000));
      await page.goto(gotoURL);
    }

    if (tagList) {
      const tags = tagList.split(",");
      for (let i = 0; i < tags.length; i += 1) {
        await page.locator(`span ::-p-text(${tags[i]})`).click();
        await new Promise((r) => setTimeout(r, 3000));
      }

      const titleResult = await page.$eval(
        titleHTMLElementString,
        (el) => el.innerHTML
      );

      if (titleResult) {
        fs.readFile("./result.txt", "utf8", (err, data) => {
          if (err) {
            console.error("readFile error =>", err);
            return;
          }
          const titleIndex = titleResult.slice(0, 2);
          if (Number(data) < Number(titleIndex)) {
            fs.writeFile("./result.txt", titleIndex, (err) => {
              if (err) {
                console.error("writeFile error =>", err);
              }
              // 创建一个SMTP客户端配置
              const nodemailerConfig = {
                // 163邮箱 为smtp.163.com
                host: "smtp.qq.com",
                //端口
                port: 465,
                auth: {
                  // 发件人邮箱账号
                  user: nodemailerConfigUser,
                  //发件人邮箱的授权码
                  pass: nodemailerConfigPass,
                },
              };
              const transporter = nodemailer.createTransport(nodemailerConfig);

              // 创建一个收件人对象
              transporter.sendMail(
                {
                  from: sendMailFrom,
                  to: sendMailTo,
                  subject: `${emailSubject} - ${titleResult}`,
                  text: `${titleResult}`,
                },
                (error, info) => {
                  if (error) {
                    return console.log("sendMail error:", error);
                  }
                  transporter.close();
                  console.log("mail sent:", info.response);
                }
              );
            });
          }
        });
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await browser.close();
  }
})();
