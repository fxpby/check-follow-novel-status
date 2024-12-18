const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const mysql = require("mysql");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const mysqlConfig = process.env.MYSQL_CONFIG;

  const connection = mysql.createConnection(JSON.parse(mysqlConfig));
  const queryById = ({ id, column } = {}) => {
    const sql = `SELECT ${column} FROM novel where id = ${id}`;
    return new Promise((resolve, reject) => {
      connection.query(sql, (err, res) => {
        if (err) {
          console.log("err: ", err);
          reject(err);
        }
        console.log("update:", res[0][column]);
        resolve(res[0][column]);
      });
    });
  };
  const updateById = ({ id, column, value } = {}) => {
    const sql = `UPDATE novel set ${column} = ${value} where id = ${id}`;
    return new Promise((resolve, reject) => {
      connection.query(sql, (err, res) => {
        if (err) {
          console.log("err: ", err);
          reject(err);
        }
        console.log("update:", res);
        resolve(res);
      });
    });
  };

  const gotoURL = process.env.GO_TO_URL;
  const gotoURL2 = process.env.GO_TO_URL_2;
  const chaptersHTMLElementString = process.env.CHAPTERS_HTML_ELEMENT_STRING;
  const entryHTMLElementString = process.env.ENTRY_HTML_ELEMENT_STRING;
  const titleHTMLElementString = process.env.TITLE_HTML_ELEMENT_STRING;
  const nodemailerConfigUser = process.env.CONFIG_AUTH_USER;
  const nodemailerConfigPass = process.env.CONFIG_AUTH_PASS;
  const sendMailTo = process.env.SEND_MAIL_TO;
  const sendMailFrom = process.env.SEND_MAIL_FROM;
  const emailSubject = process.env.EMAIL_SUBJECT;
  const authTokens = process.env.WEB_AUTH_TOKEN;
  const cookieDomain = process.env.COOKIE_DOMAIN;

  try {
    await page.goto(gotoURL);
    const entryElement = await page.$(entryHTMLElementString);
    if (entryElement) {
      entryElement.click();
      await new Promise((r) => setTimeout(r, 5000));
    }

    const parseAuthTokens = JSON.parse(authTokens);

    if (parseAuthTokens) {
      for (let i = 0; i < parseAuthTokens.length; i += 1) {
        await page.setCookie({
          domain: cookieDomain,
          name: `authtoken${i + 1}`,
          value: parseAuthTokens[i],
        });
      }
    }

    await page.goto(gotoURL2);
    await new Promise((r) => setTimeout(r, 5000));

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

    try {
      await page.waitForSelector(titleHTMLElementString);
      const chapter = await page.$eval(
        chaptersHTMLElementString,
        (el) => el.innerHTML
      );
      const titleResult = await page.$eval(
        titleHTMLElementString,
        (el) => el.innerHTML
      );

      if (chapter && titleResult) {
        console.log("find chapter and titleResult, chapter is ", chapter);
        await updateById({ id: 1, column: "auth", value: "1" });
        const lastChapter = await queryById({ id: 1, column: "last_chapter" });

        if (Number(lastChapter) < Number(chapter)) {
          // 创建一个收件人对象
          transporter.sendMail(
            {
              from: sendMailFrom,
              to: sendMailTo,
              subject: `${emailSubject} - ${titleResult}`,
              text: `${titleResult}`,
            },
            async (error, info) => {
              if (error) {
                return console.log("sendMail error:", error);
              }
              transporter.close();
              console.log("mail sent:", info.response);
              await updateById({
                id: 1,
                column: "last_chapter",
                value: chapter,
              });
              connection.end();
              return;
            }
          );
        } else {
          connection.end();
          return;
        }
      }
    } catch (err) {
      const auth = await queryById({ id: 1, column: "auth" });

      if (Number(auth)) {
        // 创建一个收件人对象
        transporter.sendMail(
          {
            from: sendMailFrom,
            to: sendMailTo,
            subject: `auth 失效`,
            text: `auth 失效`,
          },
          (error, info) => {
            if (error) {
              return console.log("sendMail error:", error);
            }
            transporter.close();
            console.log("mail sent:", info.response);
          }
        );
      }
      await updateById({ id: 1, column: "auth", value: "0" });
      connection.end();
      throw err;
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await browser.close();
  }
})();
