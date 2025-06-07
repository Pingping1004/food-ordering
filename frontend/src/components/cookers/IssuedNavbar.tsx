import React, { useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { cva } from "class-variance-authority";

const issuedNavbarVariants = cva("", {
    variants: {
        variant: {
            delay: "",
            cancel: "",
        }
    }
})