"use client"

import type React from "react"
import { useState } from "react"
import { Paperclip } from "lucide-react"
import Image from "next/image"

interface ImageUploadProps {
  className?: string
}

const ImageUpload: React.FC<ImageUploadProps> = ({ className }) => {
  const [selectedImages, setSelectedImages] = useState<File[]>([])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newImages = Array.from(files)
      setSelectedImages((prevImages) => [...prevImages, ...newImages])
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages((prevImages) => prevImages.filter((_, i) => i !== index))
  }

  return (
    <div className={`w-full flex flex-col mb-0 ${className}`}>
      <div className="flex justify-between gap-1 mb-2 w-full p-2">
        <div className="flex flex-wrap gap-2">
          {selectedImages.map((image, index) => (
            <div key={index} className="relative">
              <Image
                src={URL.createObjectURL(image) || "/placeholder.svg"}
                alt="Selected"
                className="h-20 w-20 object-cover rounded-md"
                width={80}
                height={80}
              />
              <button
                type="button"
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center"
                onClick={() => removeImage(index)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center mb-2">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="image-upload"
          multiple
          onChange={handleImageChange}
        />
        <button
          type="button"
          className="h-10 w-10 rounded-full text-[#004D49] cursor-pointer"
          onClick={() => document.getElementById("image-upload")?.click()}
        >
          <Paperclip className="h-10 w-10" />
        </button>
      </div>
    </div>
  )
}

export default ImageUpload
