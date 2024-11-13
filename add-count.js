const puppeteer = require("puppeteer");

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
  const addCountUrl2 = process.env.ADD_COUNT_URL2;
  const addCountUrlListString = process.env.ADD_COUNT_URL_LIST;
  const lastChapterHTMLElementString =
    process.env.LAST_CHAPTER_HTML_ELEMENT_STRING;

  const addCountUrlList = JSON.parse(addCountUrlListString);

  const execute = async ({ page, browser, i: browserIndex } = {}) => {
    console.log("browser index: ", browserIndex);
    await page.setDefaultNavigationTimeout(60000);
    const mysqlConfig = process.env.MYSQL_CONFIG;

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

          await page.waitForSelector(lastChapterHTMLElementString);

          if (addCountUrl) {
            console.log(
              "browserIndex-",
              browserIndex,
              "getData start => ",
              getData()
            );

            for (let i = 0; i < 100; i += 1) {
              let num = Math.floor(Math.random() * 29);
              const url = addCountUrlList[num];
              await page.goto(url);
              await sleep(3000);
              console.log(
                num,
                " ,browserIndex-",
                browserIndex,
                " goto count: ",
                i + 1
              );
            }
            console.log(
              "browserIndex-",
              browserIndex,
              "getData end => ",
              getData()
            );
            return;
          }
        }
      } catch (err) {
        throw err;
      }
    } catch (error) {
      console.error("An error occurred:", error);
    } finally {
      await browser.close();
    }
  };

  const loop = 2;

  const browserList = [];
  const pageList = [];
  for (let i = 0; i < loop; i += 1) {
    browserList[i] = await puppeteer.launch({ headless: true });
    pageList[i] = await browserList[i].newPage();
  }
  // execute({ browser: browserList[0], page: pageList[0] });
  await Promise.all(
    browserList.map(async (browser, i) =>
      execute({ browser, page: pageList[i], i })
    )
  );
})();
