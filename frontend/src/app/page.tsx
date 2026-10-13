import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import WhatIs from '@/components/WhatIs'
import Comparison from '@/components/Comparison'
import ForStudents from '@/components/ForStudents'
import ForRestaurants from '@/components/ForRestaurants'
import HowItWorks from '@/components/HowItWorks'
import Tutorial from '@/components/Tutorial'
import FAQ from '@/components/FAQ'
 
export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <WhatIs />
      <Comparison />
      <ForStudents />
      <ForRestaurants />
      <HowItWorks />
      <Tutorial />
      {/* <Screenshots /> */}
      <FAQ />
    </main>
  )
}