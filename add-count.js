const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const mysql = require("mysql");

const sleep = (gap) =>
  new Promise((resolve) => {
    setTimeout(resolve, gap);
  });

const getData = (n) => {
  let now = n ? new Date(n) : new Date(),
    y = now.getFullYear(),
    m = now.getMonth() + 1,
    d = now.getDate();
  return (
    y +
    "-" +
    (m < 10 ? "0" + m : m) +
    "-" +
    (d < 10 ? "0" + d : d) +
    " " +
    now.toTimeString().substr(0, 8)
  );
};

(async () => {
  const mysqlConfig = process.env.MYSQL_CONFIG;

  const connection = mysql.createConnection(JSON.parse(mysqlConfig));
  const queryById = ({ id, column } = {}) => {
    const sql = `SELECT ${column} FROM novel where id = ${id}`;
    console.log("sql: ", sql);
    return new Promise((resolve, reject) => {
      connection.query(sql, (err, res) => {
        if (err) {
          console.log("err: ", err);
          reject(err);
        }
        console.log("query:", res[0]);
        console.log("query:", res[0][column]);
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
  const addCountUrl = process.env.ADD_COUNT_URL;
  const lastChapterHTMLElementString =
    process.env.LAST_CHAPTER_HTML_ELEMENT_STRING;

  const execute = async ({ page, browser, i } = {}) => {
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

          await page.waitForSelector(lastChapterHTMLElementString);

          if (addCountUrl) {
            console.log("getData start => ", getData());

            for (let i = 0; i < 100; i += 1) {
              await page.goto(addCountUrl);
              await sleep(1000);
              console.log("goto count: ", i + 1);
            }
            console.log("getData end => ", getData());
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
  };

  const loop = 1;

  const browserList = [];
  const pageList = [];
  for (let i = 0; i < loop; i += 1) {
    browserList[i] = await puppeteer.launch({ headless: true });
    pageList[i] = await browserList[i].newPage();
  }
  // execute({ browser: browserList[0], page: pageList[0] });
  Promise.all(
    browserList.map(async (browser, i) =>
      execute({ browser, page: pageList[i], i })
    )
  );
})();
