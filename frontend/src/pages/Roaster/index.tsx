import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import dayjs, { Dayjs } from "dayjs";
import isoWeekPlugin from "dayjs/plugin/isoWeek";
import WeekPicker from "../../components/WeekPicker";
import styles from "./index.module.scss";
import { tableHeader } from "./constant";

dayjs.extend(isoWeekPlugin);

const RoasterPage: React.FC = () => {
  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(dayjs());

  return (
    <Box className={styles.container}>
      <header className={styles["container__header"]}>
        <Typography
          variant="h5"
          className={styles["container__header--title"]}
          sx={{ marginBottom: 0 }}
        >
          Duty Roster
        </Typography>
        <WeekPicker
          value={selectedWeek}
          onChange={(newVal) => setSelectedWeek(newVal)}
        />
      </header>

      <section className={styles["container__roasterContainer"]}>
        <header className={styles["container__roasterContainer__header"]}>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {"VSSC/DCS/2026"}
          </label>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {"SCHEDULE FOR ROUND THE CLOCK MANNING OF DATA CENTRE FACILITY"}
          </label>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {`CITG VSSC From ${selectedWeek.startOf("isoWeek").format("DD-MM-YYYY")} to ${selectedWeek.endOf("isoWeek").format("DD-MM-YYYY")}`}
          </label>
          <label
            className={styles["container__roasterContainer__header__label"]}
          >
            {
              "The contract staff identified by respective contractors for operations in DCS FACILITY for shift duty and holidays are as follows."
            }
          </label>
        </header>

        <section className={styles["container__roasterContainer__table"]}>
          <article
            className={styles["container__roasterContainer__table--header"]}
          >
            {tableHeader?.map((header) => (
              <div
                className={
                  styles["container__roasterContainer__table--header-cell"]
                }
              >
                <label>{header}</label>
              </div>
            ))}
          </article>

          <article
            className={styles["container__roasterContainer__table--body"]}
          >
            {Array.from({ length: 7 }).map((_, index) => {
              const currentDay = selectedWeek
                .startOf("isoWeek")
                .add(index, "day");
              return (
                <aside
                  key={index}
                  className={
                    styles["container__roasterContainer__table--body-cell"]
                  }
                >
                  <div
                    className={
                      styles[
                        "container__roasterContainer__table--body-cell--row1"
                      ]
                    }
                  >
                    <label>{currentDay.format("DD/MM/YY")}</label>
                    <label>{currentDay.format("dddd")}</label>
                  </div>

                  <div
                    className={
                      styles[
                        "container__roasterContainer__table--body-cell--row2"
                      ]
                    }
                  >
                    <label>{"Athul"}</label>
                    <label>{"Sarath"}</label>
                  </div>

                  <div
                    className={
                      styles[
                        "container__roasterContainer__table--body-cell--row2"
                      ]
                    }
                  >
                    <label>{"Vinod"}</label>
                    <label>{"Aneesh"}</label>
                  </div>

                  <div
                    className={
                      styles[
                        "container__roasterContainer__table--body-cell--row2"
                      ]
                    }
                  >
                    <label>{"Chandrakumar"}</label>
                    <label>{"Gautham"}</label>
                  </div>
                </aside>
              );
            })}
          </article>
        </section>

        <footer className={styles["container__roasterContainer__footer"]}>
          <label
            className={
              styles["container__roasterContainer__footer--kindlyLabel"]
            }
          >
            {
              "* Kindly permit the persons on shift 3 from 08:00 PM and shift 2 from 09:00 am onwards."
            }
          </label>
          <article
            className={styles["container__roasterContainer__footer--section1"]}
          >
            <label>{"MANAGER DCS"}</label>
            <label>{"Approved By"}</label>
          </article>

          <article
            className={styles["container__roasterContainer__footer--section2"]}
          >
            <aside  className={styles["container__roasterContainer__footer--section2--left"]}>
              <label>{"CC:Asst.Commandant"}</label>
              <label>{"CC:Head,TOMD"}</label>
              <label>{"CC:Duty Officer"}</label>
              <label>{"CC:File"}</label>
            </aside>
            
            <aside  className={styles["container__roasterContainer__footer--section2--right"]}>
              <label>{"SUJITH S"}</label>
              <label>{"GD,CITG"}</label>
            </aside>
          </article>
        </footer>
      </section>
    </Box>
  );
};

export default RoasterPage;
